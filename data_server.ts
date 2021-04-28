import { Application, Router } from "https://deno.land/x/oak@v7.3.0/mod.ts";
import { StarWarsPerson } from "./types.ts";

const json = await Deno.readTextFile("star_wars_people.json");
const peopleArray = JSON.parse(json) as StarWarsPerson[];

const router = new Router();

router
  .get('/products', (context: any) => {
    context.response.body = JSON.stringify(peopleArray, null, '  ');
  })

const app = new Application();
app.use(router.routes());

console.log("Listening for requests...")

await app.listen({port: 8000 });