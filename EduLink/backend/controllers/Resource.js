const Resource = require("../models/Resource");

// Get resources for a classroom
async function getResources(req, res) {
  try {
    const { classroom } = req.params;
    const resources = await Resource.find({ classroom }).sort({
      createdAt: -1,
    });
    res.json(resources);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}

// Create new resource
async function createResource(req, res) {
  try {
    const {
      title,
      description,
      fileUrl,
      fileType,
      subject,
      topic,
      classroom,
      uploadedBy,
      uploadedByName,
    } = req.body;

    const resource = await Resource.create({
      title,
      description,
      fileUrl,
      fileType,
      subject,
      topic,
      classroom,
      uploadedBy,
      uploadedByName,
    });

    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { getResources, createResource };
