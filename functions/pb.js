import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const pocketBaseUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
export const pb = new PocketBase(pocketBaseUrl);