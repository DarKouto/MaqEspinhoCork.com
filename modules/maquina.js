// ======================================================
// MONGOOSE SCHEMA SETUP / MODEL CONFIG
// ======================================================
var mongoose = require("mongoose");

var maquinaSchema = new mongoose.Schema({
	titulo: String,
	imagem: String,
	imageId: String, //store a image ID for the edit and delete routes
	desc: String
});

module.exports = mongoose.model("Maquina", maquinaSchema);