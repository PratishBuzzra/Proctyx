import prisma from "../DB/prisma.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken'

export const CreateTeacher = async (req, res)=>{

    try {
        const {teacher_id, name, email,phone, password} = req.body;

       
        
        const checkExistingTeacher = await prisma.teacher.findUnique({
            where:{
                email:email
            }
        })
        if(checkExistingTeacher){
            return res.status(400).json({
                success: false,
                message: 'teacher with email already exist'
            })
        }


        //hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        //crate useser
        const newlycreatedTeacher = await prisma.teacher.create({
            data:{
                teacher_id: teacher_id,
                name: name,
                email: email,
                phone: phone,
                password: hashedPassword
            }
        })

        if(newlycreatedTeacher){
              res.status(201).json({
                success: true,
                message: 'teacher created successfully',
                newlycreatedTeacher: newlycreatedTeacher
            })
        }else{
             res.status(400).json({
                success: false,
                message: 'Unable to register teacher'
            })
        }
    } catch (error) {
         console.log(error);
        res.status(500).json({
            success: false,
            message: 'Some error occured in registration',
            error
        })
        
    }

}


export const LoginTeacher =async (req, res)=>{
    try {
        const {teacher_id, email, password} = req.body

        if(!teacher_id || !email || !password){
            return res.status(400).json({
                success: false,
                message: "teacher_id, email, password are required"
            })
        }

        const checkTeacher = await prisma.teacher.findUnique({
            where:{
                email:email
            }
        })
        if(!checkTeacher){
             return res.status(404).json({
                success: false,
                message: 'teacher with that email is not found please register'
            })
        }

        const isPasswordMatch = await bcrypt.compare(password, checkTeacher.password);

        if(!isPasswordMatch){
            return res.status(400).json({
                success: false,
                message: "invalid password"
            })
        }

        //token
        const accessToken = jwt.sign({
            teacher: {
                id: checkTeacher.id,
                teacher_id: checkTeacher.teacher_id,
                email: checkTeacher.email,
                role: checkTeacher.role
            }
        }, process.env.JWT_SECRET_KEY, {expiresIn: '7d'})

         res.cookie('auth-token', accessToken, {
      httpOnly: true, // Can't be accessed via JavaScript
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week expiration
      
    });

        res.status(200).json({
            success: true,
            message: "Login successful",
            authToken: accessToken,
             teacher: {
                teacher_id: checkTeacher.teacher_id,
                name: checkTeacher.name,
                email: checkTeacher.email,
                 role: checkTeacher.role
            }
        })
    } catch (error) {
         console.log(error);
        res.status(500).json({
            success: false,
            message: 'something went wrong please try again'
        })
    }
}

export const LogoutTeacher = async (req, res)=>{
    res.clearCookie('auth-token', {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
    });
    res.status(200).json({status: true, message: "logout success"})
}