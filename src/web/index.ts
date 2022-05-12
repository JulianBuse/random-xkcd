import { getXKCDData, createImageData, scrape } from './../api/xkcd';
import { Router } from "itty-router"
import { generateHtml, htmlResponse, internalServerErrorPage, notFoundPage } from "../api/html"
import { generateComicPage, getExplainXkcdComicUrl, getImageData, getNextComic, getPreviousComic, getRandomScrapedComic, } from "../api/xkcd"

const router = Router()

router.get("/", async (req) => {
    const comic = await getRandomScrapedComic()

    const url = new URL(req.url)

    if (!comic) {
        await scrape();
        return Response.redirect(`${url.protocol}//${url.host}/`)
    }

    return Response.redirect(`${url.protocol}//${url.host}/${comic}`)
})

router.get("/:comic", async (req) => {

    const params = req.params;

    if (!params) {
        return htmlResponse(internalServerErrorPage(), 500)
    }

    const comic = parseInt(params.comic);

    if (!comic || comic !== comic) {
        return htmlResponse(notFoundPage(), 404)
    }

    const page = await generateComicPage(comic)

    if (!page) {
        const explainUrl = await getExplainXkcdComicUrl(comic);

        if (!explainUrl) {
            return htmlResponse(notFoundPage(), 404)
        }

        return Response.redirect(explainUrl)
    }

    return htmlResponse(page)
})

router.get("/images/:comic", async (req) => {
    const params = req.params;

    if (!params) {
        return htmlResponse(internalServerErrorPage(), 500)
    }

    const comic = parseInt(params.comic);

    if (!comic || comic !== comic) {
        return htmlResponse(notFoundPage(), 404)
    }

    const imageRes = await getImageData(comic.toString())

    if (imageRes !== null) {
        return imageRes
    }

    const xkcdData = await getXKCDData(comic)
    
    if (!xkcdData) {
        return htmlResponse(notFoundPage(), 404)
    }

    const id = await createImageData(xkcdData.img, comic.toString());
    const response = await fetch(xkcdData.img);

    return response;
})

/*
router.get("/:comic/image", async (req) => {
    const params = req.params;

    if (!params) {
        return htmlResponse(internalServerErrorPage(), 500)
    }

    const comic = parseInt(params.comic)

    if (!comic || comic !== comic) {
        return htmlResponse(notFoundPage(), 404)
    }

    const response = await getXKCDImage(comic)

    if (!response) {
        return htmlResponse(notFoundPage(), 404)
    }

    return response
})
*/

router.get("/:comic/next", async (req) => {
    const params = req.params;
    
    if (!params) {
        return htmlResponse(await internalServerErrorPage(), 500)
    }

    const comic = parseInt(params.comic)

    if (!comic || comic !== comic) {
        return htmlResponse(notFoundPage(), 404)
    }

    const page = await getNextComic(comic)

    const url = new URL(req.url)

    if (!page) {
        return Response.redirect(`${url.protocol}//${url.host}/${comic}`)
    }

    return Response.redirect(`${url.protocol}//${url.host}/${page}`)
})

router.get("/:comic/prev", async (req) => {
    const params = req.params;
    
    if (!params) {
        return htmlResponse(internalServerErrorPage(), 500)
    }

    const comic = parseInt(params.comic)

    if (!comic || comic !== comic) {
        return htmlResponse(notFoundPage(), 404)
    }

    const page = await getPreviousComic(comic)

    const url = new URL(req.url)

    if (!page) {
        return Response.redirect(`${url.protocol}//${url.host}/${comic}`)
    }

    return Response.redirect(`${url.protocol}//${url.host}/${page}`)
})

/*
router.get("/scrape", async () => {
    await scrape();

    return new Response("Scraped")
})

router.get("/scrape/:comic", async ({params}) => {

    if (!params) {
        throw new Error()
    }

    await scrape(parseInt((params).comic as string))

    return new Response("Scraped")
})
*/

router.all("*", () => new Response("NOT FOUND", {status: 404}))

const handle = async (event: FetchEvent): Promise<Response> => {
    return router.handle(event.request)
}

const ApiRequestHandle = handle

export default ApiRequestHandle