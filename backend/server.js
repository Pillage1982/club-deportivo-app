require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Club Deportivo funcionando'
  });
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

const PORT = process.env.PORT || 3000;

console.log('Iniciando API Club Deportivo...');
console.log('PORT usado:', PORT);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});