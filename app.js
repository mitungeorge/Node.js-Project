const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser= require('body-parser');
const expressValidator = require('express-validator');
const flash = require('connect-flash');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const config = require('./config/database');
const passport = require('passport');

mongoose.connect(config.database);
let db = mongoose.connection;

db.once('open',function(){
  console.log('Connected to mongodb');
});

db.on('error', function(err){
  console.log(err);
});


const app = express();


//Article

let Article = require('./model/article');

let User = require('./model/user');

app.set('views', path.join(__dirname,'views'));
app.set('view engine','pug');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname,'public')));

app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}));

app.use(require('connect-flash')());
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});

app.use(expressValidator({
  errorFormatter: function(param, msg, value) {
      var namespace = param.split('.')
      , root    = namespace.shift()
      , formParam = root;

    while(namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param : formParam,
      msg   : msg,
      value : value
    };
  }
}));

 require('./config/passport')(passport);
 app.use(passport.initialize());
  app.use(passport.session());


  app.get('*',function(req,res,next){
    res.locals.user = req.user || null;
    next();
  });



app.get('/',function(req,res){
  Article.find({},function(err,articles){
    if(err){
      console.log(err);
    }
    else{
      res.render('index',{
        title : 'Articles',
        articles: articles
      });
    }
  });

});

app.get('/article/:id',function(req,res){
  Article.findById(req.params.id,function(err,article){
    User.findById(article.author,function(err,user){
      res.render('article',{
        article : article,
        author : user.name
      });
    });

  });
});

function ensureAuthenticated(req,res,next){
  if(req.isAuthenticated()){
    return next();
  }else{
    req.flash('danger','Please login');
    res.redirect('/users/login');
  }
}



app.get('/articles/add',ensureAuthenticated, function(req,res){
  res.render('addArticle',{
    title : 'Add Articles'
  });
});

app.post('/articles/add',function(req,res){

req.checkBody('title','Title is required').notEmpty();
//req.checkBody('author','Author is required').notEmpty();
req.checkBody('body','Body is required').notEmpty();

let errors= req.validationErrors();

if(errors){

  res.render('addArticle',{
    title : 'Add Articles',
    errors:errors
  });


}else{
  let article = new Article();
  article.title = req.body.title;
  article.author = req.user._id;
  article.body = req.body.body;

  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth()+1; //January is 0!
  var yyyy = today.getFullYear();

  if(dd<10) {
      dd = '0'+dd
  }

  if(mm<10) {
      mm = '0'+mm
  }

  today = mm + '-' + dd + '-' + yyyy;

  article.created_date = today;

  article.save(function(err){
    if(err){
      console.log(err);return;
    }
    else{
      req.flash('success','Article Added');
      res.redirect('/');
    }
  });
}

});


app.get('/article/edit/:id',ensureAuthenticated,function(req,res){
  Article.findById(req.params.id,function(err,article){
    if(article.author!=req.user._id){
      req.flash('danger','Not authorized');
      res.redirect('/');
    }
    res.render('edit_article',{
      title: 'Edit Article',
      article : article
    });
  });
});

app.post('/article/edit/:id',function(req,res){
  let article = {};
  article.title = req.body.title;
  article.author = req.user._id;
  article.body = req.body.body;

let query = {_id:req.params.id}


  Article.update(query,article,function(err){
    if(err){
      console.log(err);return;
    }
    else{
      req.flash('success','Article Updated Successfully');
      res.redirect('/');
    }
  });
});

app.delete('/article/:id', function(req,res){
  if(!req.user._id){
    res.status(500).send();
  }
  let query = {_id:req.params.id};

  Article.findById(req.params.id,function(err,article){
    if(article.author!=req.user._id){
      res.status(500).send();
    }
    else{
      Article.remove(query,function(err){
        if(err){
          console.log(err);return;
        }
        req.flash('danger','Article Deleted');
        res.send('Success');
      });

    }
  });
});


//User



app.get('/users/register',function(req,res){
  res.render('register');
});

app.post('/users/register',function(req,res){

const name = req.body.name;
const email = req.body.email;
const username = req.body.username;
const password = req.body.password;
const cpassword = req.body.cpassword;

req.checkBody('name','Name is required').notEmpty();
req.checkBody('email','Email is required').notEmpty();
req.checkBody('email','Email is not valid').isEmail();
req.checkBody('username','Username is required').notEmpty();
req.checkBody('password','Password is required').notEmpty();
req.checkBody('cpassword','Passwords donot match').equals(req.body.password);

let errors= req.validationErrors();

if(errors){

  res.render('register',{
    errors:errors
  });


}else{
  let newUser = new User({
    name: name,
    email: email,
    username: username,
    password: password
  });

  bcrypt.genSalt(10,function(err,salt){

    bcrypt.hash(newUser.password,salt,function(err,hash){
      if(err){
        console.log(err);
      }
      newUser.password= hash;
      newUser.save(function(err){
        if(err){
          console.log(err);return;
        }
        else{
          req.flash('success','You are now registered and can log in');
          res.redirect('/users/login');
        }
      });
    });
  });


}

});

app.get('/users/login',function(req,res){
  res.render('login');
});


app.post('/users/login',function(req,res,next){
  passport.authenticate('local',{
    successRedirect: '/',
    failureRedirect: '/users/login',
    failureFlash: true
  })(req,res,next);
});

app.get('/users/logout',function(req,res){
  req.logout();
  req.flash('success', 'You are logged out');
  res.redirect('../users/login');
});


app.listen(3000,function(){
  console.log('Server started at port 3000...')
});
