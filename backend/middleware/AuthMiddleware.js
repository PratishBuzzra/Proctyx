import jwt from 'jsonwebtoken'
import prisma from '../DB/prisma.js';

export const requireTeacherLogin = async (req, res, next)=>{
    try {
        const token = req.cookies['auth-token']
        if(!token){
            return res.status(401).send({
                success: false,
                message: "unauthorized acess no token provided"
            })
        }
        const decode = jwt.verify(token, process.env.JWT_SECRET_KEY)
        const teacher = await prisma.teacher.findUnique({
            where: {teacher_id: decode.teacher.teacher_id}
        })
        if(!teacher){
            return res.status(401).json({
                success: false,
                message: "unauthorized access teacher not found"
            })
        }
        req.teacher = teacher
        next()
    } catch (error) {
        if(error.name === 'TokenExpiredError'){
            return res.status(401).send({
                success: false,
                message: "token expired please try again"
            })
        }
        return res.status(401).send({
            success: false,
            message: "unauthorized access: invalid token"
        })
    }
}
