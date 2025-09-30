// src/services/users.ts
export type UserRole = "admin" | "user";

export type User = {
  id: string;
  nombre: string;
  apellido: string;
  username: string;
  password: string;
  role: UserRole;
};

// Clave en localStorage
const STORAGE_KEY = "app_users";

// Cargar usuarios desde localStorage o crear default si no hay
export function getUsers(): User[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  // Usuarios por defecto
  const defaults: User[] = [
    {
      id: crypto.randomUUID(),
      nombre: "Admin",
      apellido: "General",
      username: "admin@local",
      password: "1234",
      role: "admin",
    },
    {
      id: crypto.randomUUID(),
      nombre: "Operador",
      apellido: "Demo",
      username: "operador@local",
      password: "1234",
      role: "user",
    },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

// Guardar lista en localStorage
function saveUsers(users: User[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

// Crear un nuevo usuario
export function createUser(data: Omit<User, "id">): User {
  const users = getUsers();
  // Evitar duplicados por username
  if (users.some((u) => u.username === data.username)) {
    throw new Error("El nombre de usuario ya existe.");
  }
  const nuevo: User = { ...data, id: crypto.randomUUID() };
  users.push(nuevo);
  saveUsers(users);
  return nuevo;
}

// Eliminar usuario
export function deleteUser(id: string) {
  const users = getUsers().filter((u) => u.id !== id);
  saveUsers(users);
}

// Verificar credenciales en login
export function validateCredentials(username: string, password: string): User | null {
  const users = getUsers();
  const found = users.find((u) => u.username === username && u.password === password);
  return found ?? null;
}
