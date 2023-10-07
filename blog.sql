create database if not exists blog default character set utf8 collate utf8_general_ci;
use blog;

create table userprofile(
uid int not null primary key auto_increment,
uname varchar(100) not null,
uemail varchar(100) not null,
upass varchar(100)not null,
uimg mediumblob
);


select* from userprofile;


create table blog(
    bid INT AUTO_INCREMENT PRIMARY KEY,
    uid int, 
    bimg mediumblob,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    author VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	FOREIGN KEY (uid) REFERENCES userprofile(uid) on delete cascade
);

select * from blog;

create table comments(
  cid INT AUTO_INCREMENT PRIMARY KEY,
  uid int,
  bid int,
  commenter varchar(255),
  comments text,
  FOREIGN KEY (uid) REFERENCES userprofile (uid) on delete cascade,
  FOREIGN KEY (bid) REFERENCES blog (bid) on delete cascade
);

select * from comments;