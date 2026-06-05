const GAME_DATA = {
  rounds: [
    {
      roundNumber: 1,
      type: 'main',
      question: "What was Apple's total revenue in their 2023 financial year? (answer in $bn)",
      answer: 383,
      fullPointsRange: 0.10,
      halfPointsRange: 0.25,
      clues: {
        speaker: "Apple is the world's most valuable company by market cap — has been for most of the last decade.",
        yesno: "iPhone accounts for around 52% of Apple's total revenue.",
        drawing: "Draw this for your team: a pie chart with these slices — iPhone 52%, Services 22%, Mac 10%, iPad 8%, Wearables 8%.",
        fixedphrase: { phrase: "think bigger", clue: "Your only communication this round is to repeat this phrase to your team." },
        physical: "Convey this using only gestures and pointing — no words, no writing: Apple's revenue has roughly doubled since 2019.",
        numbers: "You may only communicate using numbers. Your clue: 2019: 260 / 2020: 275 / 2021: 366 / 2022: 394 (Apple's annual revenues in $bn).",
        silent: "You cannot communicate with your team. Write your private estimate on paper and show it to your Speaker only if they ask."
      }
    },
    {
      roundNumber: 2,
      type: 'main',
      question: "What percentage of new cars sold globally in 2023 were electric? (answer as a %)",
      answer: 18,
      fullPointsRange: 0.10,
      halfPointsRange: 0.25,
      clues: {
        speaker: "China accounts for around 60% of all electric vehicles sold globally.",
        yesno: "The answer is less than 25%.",
        drawing: "Draw this for your team: a bar chart showing EV sales growing year on year — tiny bar in 2019, growing each year to 2023, but still clearly a minority of all cars.",
        fixedphrase: { phrase: "almost there", clue: "Your only communication this round is to repeat this phrase to your team." },
        physical: "Convey this using only gestures and pointing — no words, no writing: it's a significant minority — more than 1 in 10 new cars, less than 1 in 4.",
        numbers: "You may only communicate using numbers. Your clue: 2021: 9 / 2022: 14 / Norway 2023: 82 / Germany 2023: 18 (EV % of new car sales).",
        silent: "You cannot communicate with your team. Write your private estimate on paper and show it to your Speaker only if they ask."
      }
    },
    {
      roundNumber: 3,
      type: 'main',
      question: "How many McDonald's restaurants are there worldwide? (answer in whole numbers)",
      answer: 40000,
      fullPointsRange: 0.10,
      halfPointsRange: 0.25,
      clues: {
        speaker: "McDonald's operates in over 100 countries and serves around 69 million customers every day.",
        yesno: "There are more McDonald's than Starbucks locations worldwide.",
        drawing: "Draw this for your team: a rough world map with dense clusters of dots in North America, Europe, and East Asia — sparse elsewhere.",
        fixedphrase: { phrase: "think bigger", clue: "Your only communication this round is to repeat this phrase to your team." },
        physical: "Convey this using only gestures and pointing — no words, no writing: there is roughly one McDonald's for every 200,000 people on Earth.",
        numbers: "You may only communicate using numbers. Your clue: 1955: 1 / 1970: 1,600 / 1990: 11,800 / 2000: 28,700 / 2010: 32,700 (McDonald's restaurant count by year).",
        silent: "You cannot communicate with your team. Write your private estimate on paper and show it to your Speaker only if they ask."
      }
    },
    {
      roundNumber: 4,
      type: 'wildcard',
      question: "How many stations are there on the London Underground? (answer in whole numbers)",
      answer: 272,
      clues: null
    },
    {
      roundNumber: 5,
      type: 'main',
      question: "What percentage of Fortune 500 CEOs have an MBA? (answer as a %)",
      answer: 40,
      fullPointsRange: 0.10,
      halfPointsRange: 0.25,
      clues: {
        speaker: "The most common undergraduate degree among Fortune 500 CEOs is engineering, not business.",
        yesno: "The majority of Fortune 500 CEOs do NOT have an MBA.",
        drawing: "Draw this for your team: two bars — one labelled 'MBA' at roughly 40% height, one labelled 'No MBA' at roughly 60% height.",
        fixedphrase: { phrase: "are you sure", clue: "Your only communication this round is to repeat this phrase to your team." },
        physical: "Convey this using only gestures and pointing — no words, no writing: less than half, but more than a quarter.",
        numbers: "You may only communicate using numbers. Your clue: Harvard: 25 / Stanford: 9 / Northwestern: 6 / Wharton: 6 (Fortune 500 CEOs from each MBA programme).",
        silent: "You cannot communicate with your team. Write your private estimate on paper and show it to your Speaker only if they ask."
      }
    },
    {
      roundNumber: 6,
      type: 'main',
      question: "What is Amazon's share of the US e-commerce market in 2023? (answer as a %)",
      answer: 38,
      fullPointsRange: 0.10,
      halfPointsRange: 0.25,
      clues: {
        speaker: "Amazon's nearest US e-commerce competitor is Walmart, with around 6% market share.",
        yesno: "Amazon's US e-commerce share is greater than 30%.",
        drawing: "Draw this for your team: a pie chart — one enormous slice labelled 'Amazon', then several tiny slices for Walmart, Apple, Target, and Others.",
        fixedphrase: { phrase: "think bigger", clue: "Your only communication this round is to repeat this phrase to your team." },
        physical: "Convey this using only gestures and pointing — no words, no writing: Amazon dominates — more than all other competitors combined.",
        numbers: "You may only communicate using numbers. Your clue: 2015: 26 / 2018: 31 / 2020: 39 / 2022: 37 (Amazon US e-commerce market share % by year).",
        silent: "You cannot communicate with your team. Write your private estimate on paper and show it to your Speaker only if they ask."
      }
    },
    {
      roundNumber: 7,
      type: 'wildcard',
      question: "How many hours of video are uploaded to YouTube every minute? (answer in whole numbers)",
      answer: 500,
      clues: null
    }
  ]
};

const ROLES = {
  speaker: {
    label: 'Speaker',
    color: '#0099ff',
    bgColor: 'rgba(0, 153, 255, 0.12)',
    borderColor: 'rgba(0, 153, 255, 0.5)',
    description: 'You have full communication. You are the ONLY person who can submit the team\'s answer. Lead the discussion.'
  },
  yesno: {
    label: 'Yes / No Only',
    color: '#9933ff',
    bgColor: 'rgba(153, 51, 255, 0.12)',
    borderColor: 'rgba(153, 51, 255, 0.5)',
    description: 'You can only answer questions your teammates ask you with "yes" or "no". No other words or communication.'
  },
  drawing: {
    label: 'Drawing Only',
    color: '#ff7700',
    bgColor: 'rgba(255, 119, 0, 0.12)',
    borderColor: 'rgba(255, 119, 0, 0.5)',
    description: 'You cannot speak or write words. Communicate ONLY by drawing or sketching on paper.'
  },
  fixedphrase: {
    label: 'Fixed Phrase',
    color: '#00cc66',
    bgColor: 'rgba(0, 204, 102, 0.12)',
    borderColor: 'rgba(0, 204, 102, 0.5)',
    description: 'You can only repeat your one assigned phrase — nothing else. No other words allowed.'
  },
  physical: {
    label: 'Physical Only',
    color: '#ff3344',
    bgColor: 'rgba(255, 51, 68, 0.12)',
    borderColor: 'rgba(255, 51, 68, 0.5)',
    description: 'No words, no writing. Communicate ONLY through gestures, facial expressions, and pointing.'
  },
  numbers: {
    label: 'Numbers Only',
    color: '#ffcc00',
    bgColor: 'rgba(255, 204, 0, 0.12)',
    borderColor: 'rgba(255, 204, 0, 0.5)',
    description: 'You can only say or write numbers. No words, letters, or other symbols.'
  },
  silent: {
    label: 'Silent',
    color: '#556677',
    bgColor: 'rgba(85, 102, 119, 0.12)',
    borderColor: 'rgba(85, 102, 119, 0.5)',
    description: 'You cannot communicate with your team at all. Write your private estimate and show it ONLY to the Speaker if they directly ask.'
  },
  waiting: {
    label: 'Stand By',
    color: '#445566',
    bgColor: 'rgba(68, 85, 102, 0.08)',
    borderColor: 'rgba(68, 85, 102, 0.3)',
    description: 'Your role for this round will appear when the round begins.'
  }
};

const ROLE_ORDER_6 = ['speaker', 'yesno', 'drawing', 'fixedphrase', 'physical', 'numbers'];
const ROLE_ORDER_7 = ['speaker', 'yesno', 'drawing', 'fixedphrase', 'physical', 'numbers', 'silent'];

function getConstraintForRound(teamPosition, roundNumber, teamSize) {
  const roles = teamSize === 7 ? ROLE_ORDER_7 : ROLE_ORDER_6;
  return roles[(teamPosition + roundNumber - 1) % roles.length];
}

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}
