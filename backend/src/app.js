import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import { initRealtime } from './modules/realtime/index.js';
import boardRoutes from './modules/board/rest-api/boardRoutes.js';
import { connectDB } from './shared/db.js';  

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check route for Render
app.get('/', (req, res) => {
  res.status(200).send('Backend is healthy');
});


// 1) Conectar a MongoDB 
connectDB()                                      
  .then(() => console.log('✅ DB conectada (shared/db.js)'))
  .catch(err => {
    console.error('❌ No pudo conectar DB:', err);
    process.exit(1);
  });

// 2) Montar las rutas REST
app.use('/boards', boardRoutes);

// 3) Inicializar WebSockets *tras* conectar la DB
initRealtime(server);

// 4) Levantar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Backend en puerto ${PORT}`);
});
