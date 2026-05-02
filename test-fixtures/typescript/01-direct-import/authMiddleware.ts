import { getUser } from './userService';

export const authMiddleware = (req: any, res: any) => {
  const user = getUser(req.userId);
  if (!user) return res.status(401).send();
};
