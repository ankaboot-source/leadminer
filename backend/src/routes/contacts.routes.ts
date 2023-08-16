import { Router } from "express";
import { Contacts } from "../db/Contacts";
import AuthResolver from '../services/auth/AuthResolver';
import initializeContactsController from "../controllers/contacts.controller";
import initializeAuthMiddleware from "../middleware/auth";


export default function initializeContactsRoutes(contacts: Contacts, authResolver: AuthResolver) {
    const router = Router();

    const { exportContactsCSV } = initializeContactsController(contacts);
  
    router.get('/export/csv', initializeAuthMiddleware(authResolver), exportContactsCSV);
  
    return router;
}
