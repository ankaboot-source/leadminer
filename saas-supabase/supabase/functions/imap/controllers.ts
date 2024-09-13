import { Request, Response } from "express";
import IMAPSettingsDetector from "npm:@ankaboot.io/imap-autoconfig";
export async function getIMAPConfigFromEmail(req: Request, res: Response) {
  const { email } = req.params;

  if (!email) {
    return res.status(400).json({ message: "Missing required param email." });
  }

  try {
    const config = await new IMAPSettingsDetector.default().detect(email);
    return config && Object.keys(config).length !== 0
      ? res.json({ ...config })
      : res.sendStatus(404);
  } catch (error) {
    console.log(error);
    return res.status(500).json(...error);
  }
}
