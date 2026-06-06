const usuarioModel = require('../models/usuarioModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = (req, res) => {
  const { usuario, password } = req.body;

  console.log('Intento login:', usuario);

  usuarioModel.buscarUsuario(usuario, (err, results) => {
    if (err) {
      console.error('Error buscando usuario:', err);
      return res.status(500).json({ mensaje: 'Error buscando usuario' });
    }

    if (!results || results.length === 0) {
      console.warn('Usuario no encontrado:', usuario);
      return res.status(401).json({
        mensaje: 'Usuario no encontrado'
      });
    }

    const user = results[0];

    console.log('Usuario encontrado:', {
      id: user.id,
      usuario: user.usuario,
      rol: user.rol,
      passwordLength: user.password ? user.password.length : null
    });

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        console.error('Error bcrypt:', err);
        return res.status(500).json({ mensaje: 'Error validando password' });
      }

      if (!result) {
        console.warn('Password incorrecto para:', usuario);
        return res.status(401).json({
          mensaje: 'Contraseña incorrecta'
        });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET no configurado');
        return res.status(500).json({ mensaje: 'JWT no configurado' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          usuario: user.usuario,
          rol: user.rol
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '8h'
        }
      );

      res.json({
        mensaje: 'Login exitoso',
        token,
        usuario: {
          id: user.id,
          usuario: user.usuario,
          rol: user.rol
        }
      });
    });
  });
};