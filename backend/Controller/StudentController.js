import prisma from "../DB/prisma.js";




export const createStudent = async (req, res) => {
    
    try {
      const { student_id, name, email, photoupload } = req.body;
    const checkExistingStudent = await prisma.student.findUnique({
            where:{
                email:email
            }
        })
          if(checkExistingStudent){
            return res.status(400).json({
                success: false,
                message: 'student with email already exist'
            })
        }

  if (!photoupload) {
    return res.status(400).json({ message: "Photo is required" });
  }

  const newlycreatedStudent = await prisma.student.create({
    data: {
      student_id,
      name,
      email,
      photoupload
    }
  });

  if(newlycreatedStudent){
              res.status(201).json({
                success: true,
                message: 'student created successfully',
                newlycreatedStudent: newlycreatedStudent
            })
        }else{
             res.status(400).json({
                success: false,
                message: 'Unable to register student'
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

    
};
