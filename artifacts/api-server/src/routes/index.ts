import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import staffAuthRouter from "./staff-auth.js";
import usersRouter from "./users.js";
import masterRouter from "./master.js";
import fabricRollsRouter from "./fabric-rolls.js";
import cuttingRouter from "./cutting.js";
import allocationRouter from "./allocation.js";
import receivingRouter from "./receiving.js";
import finishingRouter from "./finishing.js";
import finishedGoodsRouter from "./finished-goods.js";
import inventoryRouter from "./inventory.js";
import reportsRouter from "./reports.js";
import traceabilityRouter from "./traceability.js";
import importRouter from "./import.js";
import permissionsRouter from "./permissions.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(staffAuthRouter);
router.use(usersRouter);
router.use(masterRouter);
router.use(fabricRollsRouter);
router.use(cuttingRouter);
router.use(allocationRouter);
router.use(receivingRouter);
router.use(finishingRouter);
router.use(finishedGoodsRouter);
router.use(inventoryRouter);
router.use(reportsRouter);
router.use(traceabilityRouter);
router.use(importRouter);
router.use(permissionsRouter);

export default router;
