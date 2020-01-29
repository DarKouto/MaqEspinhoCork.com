// ======================================================
// REQUIRING NPM PACKAGES
// ======================================================
var express          = require("express"), //npm install express
	app              = express(),
	methodOverride   = require("method-override"), //npm install method-override
	bodyParser       = require("body-parser"), //npm install body-parser
	mongoose         = require("mongoose"), //npm install mongoose
	passport         = require("passport"), //npm install passport
	LocalStrategy    = require("passport-local"), //npm install passport-local
	flash            = require("connect-flash"); //npm install connect-flash

//===========================================
// REQUIRING MULTER AND CLOUDINARY FOR IMAGES
//===========================================
// Multer
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Apenas são permitidos ficheiros de imagem!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter});

// Cloudinary
var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'danielcouto99', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


//================================
// REQUIRING DATABASE SCHEMAS
//================================
var Maquina = require("./modules/maquina"),
	User    = require("./modules/user");


//================================
// APP CONFIGURATION
//================================
app.set("view engine", "ejs"); // npm install ejs
app.use(methodOverride('_method'));
app.use(flash());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));

// CONNECT TO DATABASE
mongoose.connect(process.env.MAQDATABASEURL,
				{ useNewUrlParser: true,
				  useUnifiedTopology: true,
				  useFindAndModify: false
 }).then(() => {
	console.log('Connected to DB!');
}).catch(err => {
	console.log('ERROR:', err.message);
});


//==========================================================
// PASSPORT CONFIGURATION / Should be below other app.uses
//==========================================================
app.use(require("express-session")({ //npm install express-session
	secret: "Este é o segredo da caixa de pandora, fonte de todo o poder",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// this passes in {currentUser: req.user} to every route!
// also passes in {error and success: req.flash} to every route!
app.use(function(req, res, next) {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.addedit = req.flash("addedit");
	res.locals.success = req.flash("success");
	res.locals.logout = req.flash("logout");
	res.locals.remove = req.flash("remove");
	next();
});


//====================================
// MIDDLEWARE
//====================================
function isLoggedIn(req, res, next) {
	if(req.isAuthenticated()) {
		return next()
	}
	req.flash("error", "Precisa de estar autenticado para fazer isso");
	res.redirect("/login");
}


// ================================
// RESTFUL ROUTES
// ================================
app.get("/", function(req, res){
	res.redirect("/maquinas");
});

app.get("/contactos", function(req, res){
	res.render("contactos");
});


// INDEX ROUTE
app.get("/maquinas", function(req, res){
	Maquina.find({}, function(err, maquinas){
		if(err){
			console.log(err);
		} else
			res.render("index", { maquinas: maquinas });
	});
});


// NEW: RENDER FORM TO NEW MAQUINA
app.get("/maquinas/new", isLoggedIn, function(req, res){
	res.render("new");
});


// CREATE: HANDLE CREATE LOGIC
app.post("/maquinas", isLoggedIn, upload.single('imagem'), function(req, res){
	cloudinary.uploader.upload(req.file.path, function(result) {
		req.body.maquina.imagem = result.secure_url;
		req.body.maquina.imageId = result.public_id; // store imageID for edit and delete routes
		Maquina.create(req.body.maquina, function(err, newlyCreated){
			if(err){
				req.flash("error", "Algo de errado sucedeu");
				console.log(err);
			} else {
				req.flash("addedit", "Máquina adicionada com sucesso");
				res.redirect("/maquinas");
			}
		});
	});
});


//SHOW ROUTE
app.get("/maquinas/:id", function(req, res){
	Maquina.findById(req.params.id, function(err, foundMaquina){
		if(err){
			console.log(err);
		} else {
			res.render("show", {maquina: foundMaquina});
		}
	});
});


// EDIT: SHOW FORM TO EDIT MAQUINA
app.get("/maquinas/:id/edit", isLoggedIn, function(req, res){
	Maquina.findById(req.params.id, function(err, foundMaquina) {
		res.render("edit", {maquina: foundMaquina});
	});
});

// UPDATE: HANDLE UPDATE LOGIC
app.put("/maquinas/:id", isLoggedIn, upload.single('imagem'), function(req, res){

	Maquina.findByIdAndUpdate(req.params.id, req.body.maquina, async function(err, maquina){
		if(err) {
			console.log(err);
			req.flash("error", "Algo de errado sucedeu");
			res.redirect("/maquinas");
		} else {
			if(req.file) {
				await cloudinary.v2.uploader.destroy(maquina.imageId);
				result = await cloudinary.v2.uploader.upload(req.file.path);
				maquina.imageId = result.public_id;
				maquina.imagem = result.secure_url;
				maquina.save();
			}
			req.flash("addedit", "Máquina actualizada com sucesso");
			res.redirect("/maquinas/"+req.params.id);
		}
	});
});


// DELETE MAQUINA
app.delete("/maquinas/:id", isLoggedIn, function(req, res){
	Maquina.findByIdAndRemove(req.params.id, function(err, maquina){
		if(err){
			console.log(err);
			req.flash("error", "Algo de errado sucedeu");
			res.redirect("/maquinas");
		} else
			cloudinary.v2.uploader.destroy(maquina.imageId);
			req.flash("remove", "Máquina removida com sucesso");
			res.redirect("/maquinas");
	});
});



// ================================
// AUTHENTICATION ROUTES
// ================================
// Show Login Form
app.get("/login", function(req, res){
	res.render("login");
});

// Handle Login Logic
app.post("/login", passport.authenticate("local",
	{
		successRedirect: "/maquinas",
		failureRedirect: "/login",
		successFlash: "Bem-vindo Sr. Engenheiro",
		failureFlash: "Algo de errado sucedeu"
	}), function(req, res){
});

// LOGOUT
app.get("/logout", function(req,res){
	req.logout();
	req.flash("logout", "Saiu da área administrativa");
	res.redirect("/maquinas");
});


// ======================================================
// SERVER LISTEN
// ======================================================
var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Server Has Started!");
});

// ======================================================
// REGISTER ROUTES (TEMPORARILY DISABLED)
// ======================================================
// app.get("/register", function(req, res){
// 	res.render("register");
// });


// app.post("/register", function(req, res){
// 	var newUser = new User({username: req.body.username})
// 	User.register(newUser, req.body.password, function(err, user){
// 		if(err){
// 			req.flash("error", err.message);
//  			return res.redirect("/register");	
// 		}
// 		passport.authenticate("local")(req, res, function(){
// 			req.flash("success", "Bem-vindo " + user.username);
// 			res.redirect("/maquinas");
// 		});
// 	});
// });