// 화면 이름 → 화면 컴포넌트. App.jsx가 이 목록으로 화면을 바꾼다.
import { Diploma, Enrolled, Grades, Graduation, Welcome } from "./Certificates.jsx";
import { Community } from "./Community.jsx";
import { Courses } from "./Courses.jsx";
import { Departments, Detail } from "./Departments.jsx";
import { Experiences } from "./Experiences.jsx";
import { Home } from "./Home.jsx";
import { Lesson } from "./Lesson.jsx";
import { Major } from "./Major.jsx";
import { My } from "./My.jsx";
import { School, Splash } from "./Start.jsx";

export const SCREENS = {
  splash: Splash,
  school: School,
  departments: Departments,
  detail: Detail,
  enrolled: Enrolled,
  welcome: Welcome,
  home: Home,
  major: Major,
  lesson: Lesson,
  courses: Courses,
  grades: Grades,
  diploma: Diploma,
  graduation: Graduation,
  my: My,
  experience: Experiences,
  community: Community,
};
