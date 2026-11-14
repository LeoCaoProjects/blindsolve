import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {PairDiff} from './PairDiff';
import {compareGroups} from '../../../utils/training';
afterEach(cleanup);
for(const typed of ['ABCD','ABCE'])it(`keeps both answer rows and neutral boxes for ${typed}`,()=>{
 const result=compareGroups([{piece:'edges',tokens:['A','B','C','D']}],[typed],['A','B','C','D','E'])[0];
 const {container}=render(<PairDiff result={result} keepComparison quietErrors />);
 expect(screen.getByLabelText('yours AB')).toBeTruthy();expect(screen.getByLabelText(`yours ${typed.slice(2)}`)).toBeTruthy();
 const boxes=container.querySelectorAll('ol > li');expect(boxes.length).toBe(2);expect([...boxes].every(el=>el.classList.contains('bg-selected'))).toBe(true);expect(container.querySelectorAll('[data-recall-error]').length).toBe(typed==='ABCD'?0:1);
});
