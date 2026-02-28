

export const UploadStudentImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  res.status(201).json({
    photoPath: `uploads/students/${req.file.filename}`
  });
};
