import re

import asyncpg

from .core.config import required


def _name(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"Invalid SQL name: {value}")
    return f'"{value}"'


def _where(filters: dict | None, values: list) -> str:
    if not filters:
        return ""
    parts = []
    for column, condition in filters.items():
        operator, value = condition.split(".", 1)
        if operator != "eq":
            raise ValueError(f"Unsupported filter: {operator}")
        values.append(value)
        parts.append(f"{_name(column)} = ${len(values)}")
    return " WHERE " + " AND ".join(parts)


def _dicts(records) -> list[dict]:
    return [dict(record) for record in records]


class PostgresStore:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def close(self):
        await self.pool.close()

    async def rows(self, table, *, select="*", filters=None, order=None, limit=None):
        columns = "*" if select == "*" else ", ".join(
            _name(column.strip()) for column in select.split(",")
        )
        values = []
        sql = f"SELECT {columns} FROM public.{_name(table)}"
        sql += _where(filters, values)
        if order:
            column, direction = order.split(".", 1)
            direction = direction.upper()
            if direction not in ("ASC", "DESC"):
                raise ValueError("Invalid order.")
            sql += f" ORDER BY {_name(column)} {direction}"
        if limit is not None:
            values.append(limit)
            sql += f" LIMIT ${len(values)}"
        return _dicts(await self.pool.fetch(sql, *values))

    async def insert(self, table, body, resolution="merge-duplicates"):
        rows = body if isinstance(body, list) else [body]
        if not rows:
            return []

        columns = list(rows[0])
        values = []
        groups = []
        for row in rows:
            placeholders = []
            for column in columns:
                values.append(row[column])
                placeholders.append(f"${len(values)}")
            groups.append(f"({', '.join(placeholders)})")

        primary_key = await self.pool.fetchval(
            """
            SELECT array_agg(attribute.attname ORDER BY key.position)
            FROM pg_index index_info
            JOIN pg_class table_info ON table_info.oid = index_info.indrelid
            JOIN pg_namespace namespace ON namespace.oid = table_info.relnamespace
            JOIN unnest(index_info.indkey) WITH ORDINALITY AS key(attnum, position) ON true
            JOIN pg_attribute attribute
              ON attribute.attrelid = table_info.oid AND attribute.attnum = key.attnum
            WHERE namespace.nspname = 'public'
              AND table_info.relname = $1
              AND index_info.indisprimary
            """,
            table,
        )
        if not primary_key:
            raise RuntimeError(f"public.{table} needs a primary key.")

        conflict = ", ".join(_name(column) for column in primary_key)
        update_columns = [column for column in columns if column not in primary_key]
        if resolution == "ignore-duplicates" or not update_columns:
            action = "DO NOTHING"
        else:
            assignments = ", ".join(
                f"{_name(column)} = EXCLUDED.{_name(column)}" for column in update_columns
            )
            action = f"DO UPDATE SET {assignments}"

        sql = (
            f"INSERT INTO public.{_name(table)} "
            f"({', '.join(_name(column) for column in columns)}) "
            f"VALUES {', '.join(groups)} "
            f"ON CONFLICT ({conflict}) {action} RETURNING *"
        )
        return _dicts(await self.pool.fetch(sql, *values))

    async def update(self, table, body, filters):
        values = list(body.values())
        assignments = ", ".join(
            f"{_name(column)} = ${index}"
            for index, column in enumerate(body, start=1)
        )
        sql = f"UPDATE public.{_name(table)} SET {assignments}"
        sql += _where(filters, values)
        return _dicts(await self.pool.fetch(sql + " RETURNING *", *values))

    async def delete(self, table, filters):
        values = []
        sql = f"DELETE FROM public.{_name(table)}" + _where(filters, values)
        return _dicts(await self.pool.fetch(sql + " RETURNING *", *values))

    async def rpc(self, function, body=None):
        arguments = body or {}
        names = ", ".join(
            f"{_name(name)} => ${index}"
            for index, name in enumerate(arguments, start=1)
        )
        sql = f"SELECT * FROM public.{_name(function)}({names})"
        return _dicts(await self.pool.fetch(sql, *arguments.values()))


store: PostgresStore | None = None


def get_store() -> PostgresStore:
    if store is None:
        raise RuntimeError("Database has not started.")
    return store


async def connect():
    global store
    pool = await asyncpg.create_pool(required("DATABASE_URL"), min_size=1, max_size=10)
    store = PostgresStore(pool)


async def disconnect():
    global store
    if store:
        await store.close()
    store = None
