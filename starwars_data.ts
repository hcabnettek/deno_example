import { SWResult, StarWarsPerson } from './types.ts';

const personId: number = parseInt(Deno.args[0]);

const url: string = "https://swapi.dev/api/people/";

const response = await fetch(url);

const data = await response.json() as SWResult;

const people: StarWarsPerson[] = new Array<StarWarsPerson>()

data.results.forEach((p: StarWarsPerson) => {
  if(p.url.endsWith(`/${personId}/`)){
    people.push(p);
  }
});

Deno.writeTextFile('star_wars_people.json', JSON.stringify(people, null, '  '));