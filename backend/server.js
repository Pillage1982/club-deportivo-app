console.log('Iniciando backend club deportivo...');

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

const allowedOrigin = process.env.FRONTEND_URL;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/asistencia', require('./routes/asistenciaRoutes'));
app.use('/personas', require('./routes/personaRoutes'));
app.use('/eventos', require('./routes/eventoRoutes'));
app.use('/multas', require('./routes/multaRoutes'));
app.use('/usuarios', require('./routes/usuarioRoutes'));
app.use('/dashboard', require('./routes/dashboardRoutes'));
app.use('/finanzas', require('./routes/finanzasRoutes'));
app.use('/pagos', require('./routes/pagoRoutes'));
app.use('/cuotas', require('./routes/cuotaRoutes'));

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});