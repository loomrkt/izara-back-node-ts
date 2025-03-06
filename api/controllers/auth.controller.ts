  import { Request, Response } from "express";
  import bcrypt from "bcryptjs";
  import jwt from "jsonwebtoken";
  import client from "../../utils/database";
  import { User } from "../models/user.model";
  import passport from "passport";
  import { Strategy as GoogleStrategy } from "passport-google-oauth20";

  const ACCESS_TOKEN_EXPIRES_IN = '15m';
  const REFRESH_TOKEN_EXPIRES_IN = '7d';

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    callbackURL: "/auth/google/callback",
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const { rows } = await client.query<User>("SELECT * FROM users WHERE email = $1", [profile.emails?.[0].value]);
      let user = rows[0];
      
      if (!user) {
        const { rows: newUser } = await client.query(
          "INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING *",
          [profile.emails?.[0].value, profile.id]
        );
        user = newUser[0];
      }
      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }));

  export const loginWithGoogle = passport.authenticate("google", { scope: ["profile", "email"] });

  export const googleCallback = (req: Request, res: Response) => {
    passport.authenticate("google", { session: false }, async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ message: "Authentication failed" });
      }

      const accessToken = jwt.sign(
        { id: user.id, type: 'access' },
        process.env.JWT_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      );
      const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        process.env.JWT_SECRET as string,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      await client.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
        [user.id, refreshToken]
      );

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      const redirectUrl = `${process.env.FRONTEND_URL}/dashboard` || 'http://localhost:4200/dashboard';
      res.redirect(redirectUrl);
    })(req, res);
  };


  export const login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validation des entrées
      if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required' });
        return;
      }

      // Récupérer l'utilisateur depuis la base de données
      const { rows } = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      
      if (rows.length === 0) {
        res.status(401).json({ error: 'User  not found' });
        return;
      }

      const user = rows[0];
      
      // Comparer le mot de passe fourni avec le mot de passe haché
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Générer les jetons JWT
      const accessToken = jwt.sign(
        { id: user.id, type: 'access' },
        process.env.JWT_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      );
      const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        process.env.JWT_SECRET as string,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      // Stocker le refresh token dans la base de données (optionnel)
      await client.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
        [user.id, refreshToken]
      );

      // Définir le cookie et envoyer la réponse
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      
      res.status(201).json({ message: 'Logged in successfully' });
      return;
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  };

  export const register = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      console.log(req.body);
      //validate email and password
      if (!email || !password) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }
      //check if email is valid use regex
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(email)) {
        res.status(401).json({ message:"Invalid email or password" });
        return;
      }
      //check if user already exists
      const { rows: existingUsers } = await client.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      if (existingUsers.length > 0) {
        res.status(400).json({ message: "User already exists" });
        return;
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      const { rows } = await client.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
        [email, hashedPassword]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Registration failed" });
    }
  };

  export const refreshToken = async (req: Request, res: Response) => {
    req.cookies['accessToken'];
    const decoded = jwt.verify(req.cookies['accessToken'], process.env.JWT_SECRET as string) as jwt.JwtPayload;
    const userId = decoded.id;

    const { rows } = await client.query('SELECT token FROM refresh_tokens WHERE user_id = $1', [userId]);

    const refreshToken = rows[0].token;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET as string);
      
      if ((decoded as jwt.JwtPayload).type !== 'refresh') {
        res.status(401).json({ error: 'Invalid refresh token type' });
        return;
      }

      const newAccessToken = jwt.sign({ id: (decoded as jwt.JwtPayload).id, type: 'access' }, process.env.JWT_SECRET as string, { expiresIn: '15m' });

      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      res.status(200).json({ message: 'Access token refreshed' });
      return;
    } catch (error) {
      res.status(403).json({ error: 'Invalid or expired refresh token' });
        return;
    }
  };


  export const logout = async (req: Request, res: Response) => {
    try {
      const accessToken = req.cookies['accessToken'];
      console.log(accessToken);
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET as string, { ignoreExpiration: true }) as jwt.JwtPayload;
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [decoded.id]);
      // Supprimer le cookie
      res.clearCookie('accessToken');
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  export const checkAuth = (req: Request, res: Response) => {
    const accessToken = req.cookies['accessToken'];

    if (!accessToken) {
      res.json({ authenticated: false });
      return;
    }

    try {
      jwt.verify(accessToken, process.env.JWT_SECRET as string);
      res.json({ authenticated: true });
      return;
    } catch (error) {
      res.status(401).json({ authenticated: false });
      return;
    }
  };
