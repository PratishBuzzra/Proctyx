

export const UploadStudentImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  res.status(201).json({
    photoPath: `uploads/students/${req.file.filename}`
  });
};

export const UploadProctoringVideo = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No recording uploaded" });
  }

  res.status(201).json({
    recordingPath: `uploads/proctoring/${req.file.filename}`,
  });
};
