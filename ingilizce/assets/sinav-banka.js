/* ==========================================================================
   ACADEX ENGLISH · Speaking sınav simülatörü soru bankası (assets/sinav-banka.js), 07.11.2026
   Özgün sorular; resmî sınav metni kopyalanmaz. Havuz (ingilizce-hoca, tur 'sinav')
   yayındaysa her yeni sınav önce oradan görülmemiş set alır, yoksa buradan.
     kolay  hazırlık atlama mülakatı: isinma, resim, gorus
     orta   IELTS tarzı: part1 (konu + 4 soru), part2 (konu kartı + part3)
     zor    TOEFL iBT 2026 tarzı: tekrar (Listen & Repeat, 7 cümle), mulakat (4 soru)
   ========================================================================== */
window.SINAV_BANKA = {
  kolay: {
    isinma: ['Where are you from?', 'What do you like most about your hometown?', 'Why did you choose your department?', 'What do you usually do at the weekend?', 'Do you live in a dorm or with your family?', 'What kind of music do you listen to?', 'What is your favourite food?', 'How do you usually get to campus?', 'Do you have any brothers or sisters?', 'What do you do in your free time?', 'Which season do you like best, and why?', 'What was your favourite subject at high school?', 'Do you like cooking?', 'How do you relax after classes?', 'Have you ever travelled abroad?', 'What is your morning routine like?'],
    gorus: [
      ['Should students have a part-time job while they are studying?', 'What could be a problem with that?'],
      ['Is it better to study alone or in a group?', 'Why do some people prefer the other way?'],
      ['Should mobile phones be allowed in classrooms?', 'How could phones be useful in a lesson?'],
      ['Is social media good for young people?', 'What is one danger of social media?'],
      ['Is it better to live in a big city or a small town?', 'Where would you like to live in the future?'],
      ['Should university education be free for everyone?', 'Who should pay for it, then?'],
      ['Is English important for your future job?', 'What is the best way to learn it?'],
      ['Are online classes as good as face-to-face classes?', 'What is one advantage of online classes?'],
      ['Should people eat less fast food?', 'Why is fast food so popular?'],
      ['Is it a good idea to take a year off before university?', 'What would you do in that year?']
    ],
    resim: [
      { ad: 'kütüphane', anahtar: ['library', 'book', 'student', 'study', 'table', 'laptop', 'shelf', 'quiet', 'read', 'clock', 'window'], ciz: 'kutuphane' },
      { ad: 'kafe', anahtar: ['cafe', 'coffee', 'tea', 'barista', 'counter', 'customer', 'cup', 'order', 'menu', 'friends', 'talk'], ciz: 'kafe' },
      { ad: 'park', anahtar: ['park', 'tree', 'bench', 'dog', 'walk', 'children', 'play', 'ball', 'sun', 'grass', 'relax'], ciz: 'park' },
      { ad: 'otobüs durağı', anahtar: ['bus', 'stop', 'wait', 'rain', 'umbrella', 'people', 'phone', 'late', 'queue', 'street', 'weather'], ciz: 'durak' }
    ]
  },
  orta: {
    part1: [
      { konu: 'your hometown', sorular: ['Where is your hometown?', 'What is it known for?', 'Has it changed much since you were a child?', 'Would you like to live there in the future?'] },
      { konu: 'your studies', sorular: ['What are you studying at the moment?', 'Why did you choose this subject?', 'What do you find most difficult about it?', 'What would you like to do after you graduate?'] },
      { konu: 'free time', sorular: ['What do you like doing in your free time?', 'Do you prefer spending free time alone or with others?', 'Did you have the same hobbies as a child?', 'Is there a new hobby you would like to try?'] },
      { konu: 'food', sorular: ['What kind of food do you enjoy most?', 'Do you often cook for yourself?', 'Is there any food you disliked as a child but like now?', 'Do you think people eat more healthily now than in the past?'] },
      { konu: 'technology', sorular: ['Which app do you use the most?', 'How much time do you spend on your phone each day?', 'Do you think you use technology too much?', 'What did people do before smartphones?'] },
      { konu: 'weather', sorular: ['What is the weather usually like where you live?', 'What kind of weather do you like best?', 'Does the weather change your mood?', 'Do you check the weather forecast often?'] },
      { konu: 'music', sorular: ['What kind of music do you like?', 'When do you usually listen to music?', 'Have you ever learned to play an instrument?', 'Do you prefer live music or recorded music?'] },
      { konu: 'friends', sorular: ['Do you have many close friends?', 'Where did you meet your best friend?', 'What do you usually do together?', 'Is it easy to make new friends at university?'] }
    ],
    part2: [
      { kart: 'Describe a teacher who has influenced you.', maddeler: ['who this person was', 'what subject they taught', 'what they did that you remember', 'and explain why they influenced you'], kapanis: 'Are you still in touch with this teacher?', part3: ['What makes a good teacher?', 'Should teachers use more technology in class?', 'How has education changed in your country in recent years?', 'Is it better to learn from a person or from a computer?'] },
      { kart: 'Describe a place in your city that you like to visit.', maddeler: ['where it is', 'how often you go there', 'what you do there', 'and explain why you like it'], kapanis: 'Would you recommend it to a tourist?', part3: ['Why do people like visiting public places like parks?', 'Should cities spend more money on public spaces?', 'How have cities changed in the last twenty years?', 'What makes a city a good place to live?'] },
      { kart: 'Describe a skill you would like to learn.', maddeler: ['what the skill is', 'why you want to learn it', 'how you would learn it', 'and explain how it would help you'], kapanis: 'Do you know anyone who has this skill?', part3: ['Which skills are most important for young people today?', 'Is it better to learn a skill at school or by yourself?', 'Do people stop learning when they get older?', 'How has the internet changed the way people learn?'] },
      { kart: 'Describe a book or film that made you think.', maddeler: ['what it was', 'when you read or watched it', 'what it was about', 'and explain why it made you think'], kapanis: 'Would you read or watch it again?', part3: ['Why do people enjoy stories?', 'Are books still important in the age of video?', 'Should films that are based on real events be completely accurate?', 'How do stories influence the way young people think?'] },
      { kart: 'Describe a time you helped someone.', maddeler: ['who you helped', 'what the problem was', 'how you helped', 'and explain how you felt afterwards'], kapanis: 'Do you often help people around you?', part3: ['Why do some people help others more than others do?', 'Should volunteering be part of school education?', 'Do people help their neighbours less than in the past?', 'Is it the government\'s job to help people in need?'] },
      { kart: 'Describe a piece of technology you use every day.', maddeler: ['what it is', 'how long you have had it', 'what you use it for', 'and explain how your life would be without it'], kapanis: 'Is it easy to use for older people?', part3: ['How has technology changed communication?', 'Do young people depend too much on technology?', 'What technology will be important in the future?', 'Should children have smartphones?'] },
      { kart: 'Describe a trip you enjoyed.', maddeler: ['where you went', 'who you went with', 'what you did there', 'and explain why you enjoyed it'], kapanis: 'Would you like to go there again?', part3: ['Why do people like to travel?', 'Is tourism always good for a place?', 'How has travel changed in recent years?', 'Is it better to travel alone or with others?'] },
      { kart: 'Describe a goal you want to achieve in the next five years.', maddeler: ['what the goal is', 'why it is important to you', 'what you are doing to achieve it', 'and explain how you will feel if you achieve it'], kapanis: 'Have you told anyone about this goal?', part3: ['Why is it important to set goals?', 'Do young people today have different goals from their parents?', 'Should success be measured by money?', 'What stops people from achieving their goals?'] },
      { kart: 'Describe a celebration or festival in your country.', maddeler: ['what it is', 'when it takes place', 'what people do', 'and explain why it is important'], kapanis: 'Did you celebrate it last year?', part3: ['Why are traditional celebrations important?', 'Are celebrations becoming more commercial?', 'How do young people celebrate differently from older people?', 'Should schools teach about other cultures\' festivals?'] },
      { kart: 'Describe a time you changed your mind about something.', maddeler: ['what it was about', 'what you thought before', 'what made you change your mind', 'and explain how you feel about it now'], kapanis: 'Do you change your mind easily?', part3: ['Why is it difficult for some people to change their opinions?', 'Can social media change people\'s opinions?', 'Is it a sign of weakness to change your mind?', 'How can we decide if information is reliable?'] },
      { kart: 'Describe a person you know who is good at their job.', maddeler: ['who this person is', 'what their job is', 'what they do well', 'and explain why you think they are good at it'], kapanis: 'Would you like to do the same job?', part3: ['What makes someone good at their job?', 'Is job satisfaction more important than salary?', 'Which jobs will disappear in the future?', 'Should people stay in the same job for a long time?'] },
      { kart: 'Describe a time when you were very busy.', maddeler: ['when it was', 'why you were busy', 'what you had to do', 'and explain how you managed it'], kapanis: 'Do you like being busy?', part3: ['Why are people so busy nowadays?', 'Is it possible to have a good work-life balance?', 'Do students today have more pressure than before?', 'How can people manage their time better?'] }
    ]
  },
  zor: {
    tekrar: [
      { baglam: 'a campus tour', cumleler: ['Welcome to the campus.', 'The library is on your left.', 'Please show your card at the door.', 'The cafeteria closes at eight in the evening.', 'Students can book study rooms on the university website.', 'If you lose your card, report it to the main office right away.', 'The sports center offers free classes for first-year students during the autumn term.'] },
      { baglam: 'a library orientation', cumleler: ['Quiet please.', 'Books are on the second floor.', 'You can borrow five books at a time.', 'Laptops can be charged at the long tables.', 'Group study rooms must be booked at least one day in advance.', 'Overdue books will be charged a small fee for every extra day.', 'Electronic journals are available from home if you log in with your student account.'] },
      { baglam: 'dormitory rules', cumleler: ['Keep your room clean.', 'Visitors must leave by ten.', 'The laundry room is in the basement.', 'Please do not cook in your room.', 'Quiet hours start at eleven on weekdays and midnight on weekends.', 'If something in your room is broken, fill in a repair form online.', 'Residents who are going away for more than three days should inform the front desk.'] },
      { baglam: 'laboratory safety', cumleler: ['Wear your goggles.', 'No food is allowed here.', 'Wash your hands before you leave.', 'Tell the assistant if you see a spill.', 'Long hair should be tied back when you are working with flames.', 'All chemicals must be returned to the correct shelf after the session.', 'In an emergency, leave the building by the nearest exit and wait in the car park.'] }
    ],
    mulakat: [
      { konu: 'study habits', sorular: ['Thank you for joining this study. To begin, how do you usually prepare for an exam?', 'Do you prefer studying in the morning or at night? Why?', 'Some students study with music on. What do you think about that?', 'If you could change one thing about how your university teaches, what would it be and why?'] },
      { konu: 'city transport', sorular: ['We are researching how students travel. How do you usually get to campus?', 'What is the biggest problem with public transport in your city?', 'Should cities make public transport free for students? Why or why not?', 'How do you think people will travel in cities twenty years from now?'] },
      { konu: 'technology and sleep', sorular: ['This interview is about sleep. How many hours do you usually sleep on a school night?', 'Do you use your phone before you go to sleep?', 'Some experts say screens should be banned from bedrooms. Do you agree?', 'What advice would you give a first-year student about sleep during exam weeks?'] },
      { konu: 'food on campus', sorular: ['We are asking students about campus food. Where do you usually eat lunch?', 'What do you think of the food options on your campus?', 'Should universities only sell healthy food? Why or why not?', 'If you could open a café on campus, what would make it different?'] },
      { konu: 'volunteering', sorular: ['This study is about volunteering. Have you ever done any volunteer work?', 'Why do you think some students volunteer and others do not?', 'Should volunteering count towards a university degree?', 'Describe a volunteer project that would be useful in your community.'] },
      { konu: 'online learning', sorular: ['We are studying online learning. Have you taken any online courses?', 'What is the hardest part of learning online for you?', 'Do you think online degrees should be valued as much as traditional ones?', 'How could universities make online classes more engaging?'] }
    ]
  }
};
