// src/types/Movement.ts
export interface Movement {
  id: number;
  timestamp: string;
  actor?: { name: string };
  user?: string;   // <--- propiedad que faltaba
  // agrega aquí otras propiedades que ya uses en tu app
}
