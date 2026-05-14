import { Router } from "express";
import { getConfigurables, getConfigurablesData } from "../controllers/configurables.controller";

const router = Router();

router.get("/configurables", getConfigurables);
router.get("/configurables/data", getConfigurablesData);

export default router;
