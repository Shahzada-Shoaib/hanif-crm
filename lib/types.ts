export type Connection = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  verifiedName: string;
  webhookSubscribed: boolean;
  updatedAt: number;
};
export type ChatMessage = {
  id: string;
  phoneNumberId: string;
  from: string;
  to: string;
  text: string;
  direction: "in" | "out";
  timestamp: number;
};
