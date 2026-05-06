create table if not exists departments (
  id serial primary key,
  department_name text not null unique
);

create table if not exists students (
  id serial primary key,
  name text not null,
  age int not null,
  dept_id int references departments(id)
);

create table if not exists courses (
  id serial primary key,
  course_name text not null,
  dept_id int references departments(id)
);

create table if not exists attendance (
  id serial primary key,
  student_id int references students(id) unique,
  attendance_percent numeric(5,2) not null
);

insert into departments (department_name)
values ('CSE'), ('ECE'), ('MECH')
on conflict (department_name) do nothing;

-- seed with deterministic ids for easy demo joins
insert into students (id, name, age, dept_id)
values
  (1, 'Asha', 19, 1),
  (2, 'Ravi', 20, 1),
  (3, 'Meera', 18, 2)
on conflict do nothing;

insert into attendance (student_id, attendance_percent)
values (1, 82.5), (2, 71.0), (3, 90.0)
on conflict (student_id) do nothing;

insert into courses (course_name, dept_id)
values ('DBMS', 1), ('Networks', 1), ('Circuits', 2)
on conflict do nothing;

