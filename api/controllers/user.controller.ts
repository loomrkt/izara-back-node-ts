import { Request, Response } from 'express';
import { supabase } from "../../utils/database";

interface User {
  id: string;
}

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userId = (req.user as User).id;

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single(); // Récupère un seul enregistrement

    if (error || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user); // Retourner le profil de l'utilisateur
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
