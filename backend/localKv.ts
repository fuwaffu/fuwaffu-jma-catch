import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const WEATHER_DATA_STORE = {
  async get(key: string, options?: { type?: string }) {
    const file = path.join(dataDir, `${key}.json`);
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return options?.type === 'json' ? JSON.parse(data) : data;
    }
    return null;
  },
  async put(key: string, value: string) {
    const file = path.join(dataDir, `${key}.json`);
    fs.writeFileSync(file, value, 'utf8');
  },
  async delete(key: string) {
    const file = path.join(dataDir, `${key}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
};
