import { Account, Avatars, Client, Functions, Storage, TablesDB } from "appwrite";
import { env } from "./env";
import { LIMITE_LECTURA_MS, SinCoberturaError, hayCobertura, marcarSinCobertura } from "./cobertura";

export const client = new Client().setEndpoint(env.endpoint).setProject(env.projectId);

// Todas las llamadas del SDK pasan por `call`: sin cobertura no sale ninguna, y
// una lectura que no llega a tiempo o un fallo de red apagan la cobertura.
const llamar = client.call.bind(client);
client.call = async (method, url, headers, params, responseType) => {
  if (!hayCobertura()) throw new SinCoberturaError();
  try {
    const peticion = llamar(method, url, headers, params, responseType);
    if (method.toUpperCase() !== "GET") return await peticion;
    return await Promise.race([
      peticion,
      new Promise((_, reject) => setTimeout(() => reject(new SinCoberturaError()), LIMITE_LECTURA_MS)),
    ]);
  } catch (err) {
    // `fetch` solo lanza TypeError cuando no llega a haber respuesta.
    if (!(err instanceof TypeError || err instanceof SinCoberturaError)) throw err;
    marcarSinCobertura();
    throw new SinCoberturaError();
  }
};

export const account = new Account(client);
export const tables = new TablesDB(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export const avatars = new Avatars(client);

export { Channel, ID, OAuthProvider, Permission, Query, Role } from "appwrite";
export type { Models } from "appwrite";
