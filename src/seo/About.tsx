import guide from './guide.html?raw';

export function About() {
  return <div dangerouslySetInnerHTML={{ __html: guide }} />;
}
