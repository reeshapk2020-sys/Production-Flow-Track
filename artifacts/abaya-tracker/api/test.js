export default function handler(req, res) {
  console.log("Test endpoint hit!");
  res.status(200).json({ 
    message: "Test working!",
    timestamp: new Date().toISOString()
  });
}
