// src/pages/api/revalidate.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Comprobar el secreto para prevenir revalidación no autorizada
  if (req.query.secret !== process.env.REVALIDATION_SECRET) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    // Ruta a revalidar
    const path = req.query.path as string;
    if (!path) {
      return res.status(400).json({ message: 'Path is required' });
    }

    // Realizar la revalidación
    await res.revalidate(path);
    
    return res.status(200).json({ revalidated: true, path });
  } catch (error) {
    return res.status(500).json({ message: 'Error revalidating', error: String(error) });
  }
}