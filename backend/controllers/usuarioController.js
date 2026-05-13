const usuarioModel = require('../models/usuarioModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = (req, res) => {

  const { usuario, password } = req.body;

  usuarioModel.buscarUsuario(usuario, (err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    if (results.length === 0) {
      return res.status(401).json({
       mensaje: 'Usuario no encontrado'
      });
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, result) => {

      if (err) {
        return res.status(500).send(err);
      }

      if (!result) {
        return res.status(401).json({
          mensaje: 'Contraseña incorrecta'
        });
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