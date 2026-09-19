// Middleware de autenticación del Portal del Socio: valida el JWT y exige el
// claim tipo === 'socio'. Deliberadamente separado de authMiddleware (admin)
// para que un token de socio nunca sirva en una ruta admin ni viceversa,
// aunque ambos se firmen con el mismo JWT_SECRET.
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.tipo !== 'socio') {
      return res.status(401).json({ mensaje: 'Token inválido' });
    }

    req.socio = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};
