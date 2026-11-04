import { Router, type Request, type Response } from "express";
import {
  acceptTeamInvite,
  createTeamWorkspace,
  getTeamForUser,
  inviteTeamMember,
  removeTeamMember,
  updateTeamSettings,
} from "../services/teamStore.js";
import { AppError } from "../utils/errors.js";

export function teamRoutes(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const team = getTeamForUser(user.id);
    res.json({ team });
  });

  router.post("/", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const { name } = req.body as { name?: string };
    const team = createTeamWorkspace({
      ownerId: user.id,
      ownerEmail: user.email,
      ownerName: user.fullName,
      name: name ?? "My Team Workspace",
    });
    res.status(201).json({ team });
  });

  router.post("/invite", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const team = getTeamForUser(user.id);
    if (!team) throw new AppError(404, "You do not have an active team workspace.");

    const { email, role } = req.body as { email?: string; role?: "editor" | "viewer" };
    if (!email || typeof email !== "string" || !email.includes("@")) {
      throw new AppError(400, "Valid email address is required.");
    }

    try {
      const invite = inviteTeamMember(team.id, user.id, email, role ?? "editor");
      res.status(201).json({ invite });
    } catch (err: unknown) {
      throw new AppError(400, err instanceof Error ? err.message : String(err));
    }
  });

  router.post("/accept-invite", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string") {
      throw new AppError(400, "Invitation token is required.");
    }

    try {
      const team = acceptTeamInvite(token, {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      });
      res.json({ team });
    } catch (err: unknown) {
      throw new AppError(400, err instanceof Error ? err.message : String(err));
    }
  });

  router.delete("/members/:memberId", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const team = getTeamForUser(user.id);
    if (!team) throw new AppError(404, "Team not found.");

    try {
      const ok = removeTeamMember(team.id, user.id, req.params.memberId);
      res.json({ ok });
    } catch (err: unknown) {
      throw new AppError(400, err instanceof Error ? err.message : String(err));
    }
  });

  router.patch("/settings", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const team = getTeamForUser(user.id);
    if (!team) throw new AppError(404, "Team not found.");

    try {
      const updated = updateTeamSettings(team.id, user.id, req.body);
      res.json({ team: updated });
    } catch (err: unknown) {
      throw new AppError(400, err instanceof Error ? err.message : String(err));
    }
  });

  return router;
}
