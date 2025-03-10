  import { Request, Response } from "express";
  import bcrypt from "bcryptjs";
  import jwt from "jsonwebtoken";
  import { supabase } from "../../utils/database";
  import { User } from "../models/user.model";
  import passport from "passport";
  import { Strategy as GoogleStrategy } from "passport-google-oauth20";
  import * as dotenv from "dotenv";
  dotenv.config;

  const ACCESS_TOKEN_EXPIRES_IN = "15m";
  const REFRESH_TOKEN_EXPIRES_IN = "7d";

  function generateStrongPassword(length: number = 16): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{}|;:'\",.<>?/";

    const allCharacters = uppercase + lowercase + numbers + symbols;

    let password = "";

    // S'assurer que le mot de passe contient au moins un de chaque type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Remplir le reste avec des caractères aléatoires
    for (let i = password.length; i < length; i++) {
      password +=
        allCharacters[Math.floor(Math.random() * allCharacters.length)];
    }

    // Mélanger les caractères pour éviter un motif prévisible
    return password
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Vérifier si l'utilisateur existe déjà
          let { data: newUser, error } = await supabase
            .from("users")
            .select("*")
            .or(
              `email.eq.${profile.emails?.[0].value},google_id.eq.${profile.id}`
            )
            .single();

          if (error && error.code !== "PGRST116") {
            // Ignorer l'erreur "no rows returned"
            throw error;
          }

          let user = newUser;

          // Si l'utilisateur n'existe pas, l'insérer
          if (!user) {
            const { data, error: insertError } = await supabase
              .from("users")
              .insert([
                {
                  email: profile.emails?.[0].value,
                  google_id: profile.id,
                  password: generateStrongPassword(),
                },
              ])
              .select()
              .single();

            if (insertError) {
              throw insertError;
            }

            user = data;
          }

          done(null, user);
        } catch (err) {
          console.error(
            "Erreur lors de la récupération ou de l'insertion de l'utilisateur :",
            err
          );
          done(err, false);
        }
      }
    )
  );

  export const loginWithGoogle = passport.authenticate("google", {
    scope: ["profile", "email"],
  });

  export const googleCallback = (req: Request, res: Response) => {
    passport.authenticate("google", { session: false }, async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ message: `${err} and ${user}` });
      }

      const accessToken = jwt.sign(
        { id: user.id, type: "access" },
        process.env.JWT_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      );
      const refreshToken = jwt.sign(
        { id: user.id, type: "refresh" },
        process.env.JWT_SECRET as string,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const redirectUrl =
        `${process.env.FRONTEND_URL}/dashboard` ||
        "http://localhost:4200/dashboard";
      res.redirect(redirectUrl);
    })(req, res);
  };

  export const login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validation des entrées
      if (!email || !password) {
        res.status(400).json({ message: "Email and password are required" });
        return;
      }

      // Récupérer l'utilisateur depuis la base de données
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (error && error.code === "PGRST116") {
        res.status(401).json({ error: "User not found" });
        return;
      }

      if (error) {
        throw error;
      }

      // Comparer le mot de passe fourni avec le mot de passe haché
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Générer les jetons JWT
      const accessToken = jwt.sign(
        { id: user.id, type: "access" },
        process.env.JWT_SECRET!,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      );
      const refreshToken = jwt.sign(
        { id: user.id, type: "refresh" },
        process.env.JWT_SECRET!,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      // Définir les cookies et envoyer la réponse
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
      });
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

       res.status(201).json({ message: "Logged in successfully" });
       return;
    } catch (error) {
      console.error("Login error:", error);
       res.status(500).json({ error: "Internal server error" });
       return;
    }
  };

  export const register = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      console.log(req.body);
    
      // Validation de l'email et du mot de passe
      if (!email || !password) {
         res.status(401).json({ message: "Invalid email or password" });
         return;
      }
    
      // Vérification de la validité de l'email avec une regex
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(email)) {
         res.status(401).json({ message: "Invalid email or password" });
         return;
      }
    
      // Vérification si l'utilisateur existe déjà
      const { data: existingUsers, error: selectError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email);
    
      if (selectError) {
        throw selectError;
      }
    
      if (existingUsers.length > 0) {
         res.status(400).json({ message: "User already exists" });
         return;
      }
    
      // Hachage du mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);
    
      // Insertion de l'utilisateur dans la base de données
      const { data, error: insertError } = await supabase
        .from("users")
        .insert([
          {
            email,
            password: hashedPassword,
          },
        ])
        .select()
        .single();
    
      if (insertError) {
        throw insertError;
      }
    
       res.status(201).json(data);
       return;
    } catch (error) {
      console.error(error);
       res.status(500).json({ message: "Registration failed" });
       return;
    }
  };

  export const refreshToken = async (req: Request, res: Response) => {
    const refreshToken = req.cookies["refreshToken"];

    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token required" });
      return;
    }

    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET as string
      );

      if ((decoded as jwt.JwtPayload).type !== "refresh") {
        res.status(401).json({ error: "Invalid refresh token type" });
        return;
      }

      if (
        (decoded as jwt.JwtPayload).expiresIn < Math.floor(Date.now() / 1000)
      ) {
        res.status(401).json({ error: "Refresh token expiré" });
        return;
      }

      const newAccessToken = jwt.sign(
        { id: (decoded as jwt.JwtPayload).id, type: "access" },
        process.env.JWT_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      );
      const newRefreshToken = jwt.sign(
        { id: (decoded as jwt.JwtPayload).id, type: "refresh" },
        process.env.JWT_SECRET as string,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
      });
      res.clearCookie("refreshToken");
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ message: "Access token refreshed" });
      return;
    } catch (error) {
      res.status(403).json({ error: "Invalid or expired refresh token" });
      return;
    }
  };

  export const logout = async (req: Request, res: Response) => {
    try {
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        path: "/",
      });

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        path: "/",
      });

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  };
  

  export const checkAuth = (req: Request, res: Response) => {
    // Si le middleware vérifie que l'AT est valide, on peut accéder à cette route
    res.status(200).json({ authenticated: true });
  };