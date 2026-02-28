import { Router } from "express";
import {CreateTeacher, LoginTeacher, LogoutTeacher} from '../Controller/TeacherController.js'
import {requireTeacherLogin} from '../middleware/AuthMiddleware.js'


const router = Router();

router.post("/registerteacher", CreateTeacher)
router.post("/loginteacher", LoginTeacher)
router.post("/logoutteacher", LogoutTeacher)
router.get('/teacherprotected', requireTeacherLogin, (req, res) => {
  res.status(200).json({
    success: true,
    teacher: {
      teacher_id: req.teacher.teacher_id,
      name: req.teacher.name,
      email: req.teacher.email,
      role: req.teacher.role
    }
  });
});


export default router