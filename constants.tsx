
import React from 'react';
import { Job } from './types';

export const MOCK_JOBS: Job[] = [
  {
    id: '1',
    title: 'Data Analyst',
    company: 'Skyline Analytics',
    logo: 'https://picsum.photos/seed/sky/100/100',
    description: 'We are looking for a Data Analyst to join our growing team. You will be responsible for interpreting data, analyzing results using statistical techniques and providing ongoing reports.',
    location: 'San Francisco, CA',
    type: 'Full-time',
    category: 'Data Analyst'
  },
  {
    id: '2',
    title: 'Software Engineer',
    company: 'Nexus Code',
    logo: 'https://picsum.photos/seed/nexus/100/100',
    description: 'As a Software Engineer at Nexus, you will design, develop, and test software components. You will work on cutting-edge technologies to solve complex problems.',
    location: 'Remote',
    type: 'Remote',
    category: 'Software Engineer'
  },
  {
    id: '3',
    title: 'Process Engineer',
    company: 'Industria Group',
    logo: 'https://picsum.photos/seed/ind/100/100',
    description: 'Looking for a Process Engineer to oversee and optimize chemical, physical or electrical processes. Strong analytical and problem-solving skills required.',
    location: 'Austin, TX',
    type: 'Full-time',
    category: 'Process Engineer'
  },
  {
    id: '4',
    title: 'Full Stack Developer',
    company: 'Innovate Labs',
    logo: 'https://picsum.photos/seed/innov/100/100',
    description: 'Help us build the next generation of web applications. Expertise in React, Node.js, and cloud infrastructure is a must.',
    location: 'New York, NY',
    type: 'Full-time',
    category: 'Software Engineer'
  }
];

export const CATEGORIES = ['Data Analyst', 'Process Engineer', 'Software Engineer', 'Product Manager'];
