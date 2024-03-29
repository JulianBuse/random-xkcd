import * as cheerio from 'cheerio'
import * as htmlparser2 from 'htmlparser2'

export const COMIC_PREFIX = 'COMIC7:'

type XKCDApiResult = {
  num: number
  title: string
  safe_title: string
  alt: string
  transcript: string
  img: string
}

const UserAgent = 'xkcd.julianbuse.com. Email: julian@julianbuse.com'

export const getXKCDData = async (
  comic?: number,
): Promise<XKCDApiResult | null> => {
  const url = comic
    ? `https://xkcd.com/${comic}/info.0.json`
    : 'https://xkcd.com/info.0.json'

  const data = await fetch(url, {
    headers: {
      'User-Agent': UserAgent,
    },
  })

  if (data.status !== 200 && data.status !== 404) {
    throw new Error('Error fetching data from xkcd api')
  }

  if (data.status === 404) {
    return null
  }

  const jsonData: XKCDApiResult = await data.json()

  return jsonData
}

/*
export const getXKCDImage = async (comic: number): Promise<Response | null> => {
    const data = await getComicData(comic);
    if (!data) {
        return null;
    }

    const imageData = await fetch(data.image, {
        cf: {
            cacheEverything: true,
            cacheTtl: 60 * 60 * 24 * 7
        }
    })

    const response = new Response(imageData.body, imageData)

    return response;
}
*/

const getMostRecentComicNumber = async (): Promise<number | null> => {
  const data = await getXKCDData()

  if (!data) {
    return null
  }

  return data.num
}

const getTitleOfComic = async (comic: number): Promise<string | null> => {
  const data = await getXKCDData(comic)

  if (!data) {
    return null
  }

  return data.safe_title
}

export const getExplainXkcdComicUrl = async (
  comic: number,
): Promise<string | null> => {
  return `https://www.explainxkcd.com/wiki/index.php/${comic}`
}

const getMostRecentlyScrapedComic = async (): Promise<number | null> => {
  const result = await DATA.get('MOST_RECENTLY_SCRAPED')

  if (!result) {
    return null
  }

  const item = parseInt(result)

  if (item !== item) {
    return null
  }

  return item
}

const setMostRecentlyScrapedComic = async (item: number) => {
  await DATA.put('MOST_RECENTLY_SCRAPED', item.toString())
}

export const getComicToScrape = async (): Promise<number> => {
  const lastScrapedComic = await getMostRecentlyScrapedComic()
  const lastPublishedComic = await getMostRecentComicNumber()

  if (lastPublishedComic === null) {
    throw new Error('Could not get most recent comic')
  }

  if (lastScrapedComic === null) {
    return 1
  }

  if (lastScrapedComic >= lastPublishedComic) {
    return 1
  }

  return lastScrapedComic + 1
}

export const getRawResponseTextFor = async (
  url: string,
): Promise<string | null> => {
  const data = await fetch(url, {
    headers: {
      'User-Agent': UserAgent,
    },
  })

  if (data.status !== 200 && data.status !== 404) {
    console.log(
      'error response for url: ',
      url,
      ' response: ',
      await data.text(),
    )
    throw new Error('Error fetching text: ' + url)
  }

  if (data.status === 404) {
    return null
  }

  const html = await data.text()

  return html
}

export const parseHtmlOfExplainer = async (html: string): Promise<string> => {
  const $ = cheerio.load(html)

  $('table').each(function (i, elem) {
    const table = $(this)
    const tblclass = table.attr('class')

    if (tblclass?.includes('notice')) {
      table.remove()
      return
    }

    if (tblclass?.includes('wikitable')) {
      table.wrap('<div style="overflow-x: auto;"></div>')
      return
    }
  })

  $('span').each(function() {
    const span = $(this)
    const spanclass = span.attr("class")

    if (spanclass?.includes("mw-editsection")) {
      span.remove()
      return;
    }
  })

  const content = $('div.mw-parser-output > table').nextUntil('span#Discussion')

  $('*', content).each(function (i, elem) {
    const tag = $(this)
    tag.removeAttr('id')
    tag.removeAttr('class')
    tag.removeAttr('style')

    const srcAttr = tag.attr('src')
    let srcModified = false

    //check if this is a link to another comic
    if (srcAttr && srcAttr.startsWith('/wiki/index.php/')) {
      const srcReplaced = srcAttr.replace('/wiki/index.php/', '')

      let num = ''

      for (let i = 0; i < srcReplaced.length; i++) {
        if (parseInt(srcReplaced[i]) === parseInt(srcReplaced[i])) {
          num += srcReplaced[i]
          continue
        } else {
          break
        }
      }

      if (num.length !== 0 && srcReplaced[num.length] === ':') {
        tag.attr('src', `/${parseInt(num)}`)
        srcModified = true
      }
    }

    if (!srcModified && srcAttr && srcAttr[0] === '/') {
      tag.attr('src', `https://www.explainxkcd.com${srcAttr}`)
    }

    const scrsetAttr = tag.attr('srcset')

    if (typeof scrsetAttr === 'string' && scrsetAttr) {
      const srcSets = scrsetAttr.split(',').map((rawSet) => rawSet.trim())

      const finalSrcSets: string[] = []

      srcSets.forEach((set) => {
        if (set[0] === '/') {
          finalSrcSets.push(`https://www.explainxkcd.com${set}`)
        } else {
          finalSrcSets.push(set)
        }
      })

      tag.attr('srcset', finalSrcSets.join(', '))
    }

    const hrefAttr = tag.attr('href')
    let hrefModified = false

    //check if this is a link to another comic
    if (hrefAttr && hrefAttr.startsWith('/wiki/index.php/')) {
      const hrefReplaced = hrefAttr.replace('/wiki/index.php/', '')

      let num = ''

      for (let i = 0; i < hrefReplaced.length; i++) {
        if (parseInt(hrefReplaced[i]) === parseInt(hrefReplaced[i])) {
          num += hrefReplaced[i]
          continue
        } else {
          break
        }
      }

      if (num.length !== 0 && hrefReplaced[num.length] === ':') {
        tag.attr('href', `/${parseInt(num)}`)
        hrefModified = true
      }
    }

    if (!hrefModified && hrefAttr && hrefAttr[0] === '/') {
      tag.attr('href', `https://www.explainxkcd.com${hrefAttr}`)
    }
  })

  return $.html(content)
}

export type ComicData = {
  num: number
  title: string
  image: string
  alt: string
  transcription: string
  explanation: string
}

export const createImageData = async (
  url: string,
  id: string,
): Promise<string> => {
  const imageResponse = await fetch(url, {
    cf: {
      cacheEverything: true,
      cacheTtl: 60 * 5,
    },
  })

  const imageStream = imageResponse.body

  if (!imageStream) {
    throw new Error('No Image Stream')
  }

  const headers: { [key: string]: string } = {}

  imageResponse.headers.forEach((val, key) => {
    headers[key] = val
  })

  await DATA.put(`${COMIC_PREFIX.replace(':', '_IMAGES:')}${id}`, imageStream)
  await DATA.put(
    `${COMIC_PREFIX.replace(':', '_IMAGE_HEADERS:')}${id}`,
    JSON.stringify(headers),
  )

  return id
}

export const getImageData = async (id: string): Promise<Response | null> => {
  const imageStream = await DATA.get(
    `${COMIC_PREFIX.replace(':', '_IMAGES:')}${id}`,
    'stream',
  )
  const imageHeaders: { [key: string]: string } | null = await DATA.get(
    `${COMIC_PREFIX.replace(':', '_IMAGE_HEADERS:')}${id}`,
    'json',
  )

  if (!imageStream || !imageHeaders) {
    return null
  }

  return new Response(imageStream, {
    headers: imageHeaders,
  })
}

const createComicData = async (comic: number): Promise<ComicData | null> => {
  const data = await getXKCDData(comic)

  if (!data) {
    return null
  }

  const explainerUrl = await getExplainXkcdComicUrl(comic)
  if (!explainerUrl) return null

  const explainerHtml = await getRawResponseTextFor(explainerUrl)

  const explainerContent = explainerHtml
    ? await parseHtmlOfExplainer(explainerHtml)
    : ''

  const imageId = await createImageData(data.img, comic.toString())

  return {
    num: data.num,
    title: data.title,
    image: `/images/${comic}`,
    alt: data.alt,
    transcription: data.transcript,
    explanation: explainerContent,
  }
}

const saveComicData = async (comic: number, data: ComicData) => {
  await DATA.put(COMIC_PREFIX + comic.toString(), JSON.stringify(data))
}

export const getComicData = async (comic: number) => {
  const data = (await DATA.get(
    `${COMIC_PREFIX}${comic}`,
    'json',
  )) as ComicData | null
  return data
}

export const scrape = async (toScrape?: number): Promise<ComicData | null> => {
  const comic = toScrape || (await getComicToScrape())

  const data = await createComicData(comic)

  await setMostRecentlyScrapedComic(comic)

  if (!data) {
    return null
  }

  await saveComicData(comic, data)

  console.log('Scraped: ' + comic.toString())

  return data
}

const getUnsortedListOfScrapedComics = async (
  cursor?: string,
): Promise<string[]> => {
  const list = await DATA.list({
    prefix: COMIC_PREFIX,
    cursor: cursor,
  })

  const keys = list.keys.map((key) => key.name)
  if (list.list_complete) {
    return keys
  } else {
    const remainder = await getUnsortedListOfScrapedComics(list.cursor)

    return [...keys, ...remainder]
  }
}

export const getAllScrapedComics = async (): Promise<string[]> => {
  const list = await getUnsortedListOfScrapedComics()
  const sortedList = list.sort(
    (a, b) =>
      parseInt(a.replace(COMIC_PREFIX, '')) -
      parseInt(b.replace(COMIC_PREFIX, '')),
  )

  return sortedList
}

export const getNextComic = async (comic: number): Promise<number | null> => {
  const list = await getAllScrapedComics()

  const idxOfComic = list.findIndex(
    (key) => key.replace(COMIC_PREFIX, '') === comic.toString(),
  )

  if (idxOfComic === -1) {
    return null
  }

  if (list.length === 1) {
    return comic
  }

  if (idxOfComic === list.length - 1) {
    return parseInt(list[0].replace(COMIC_PREFIX, ''))
  }

  return parseInt(list[idxOfComic + 1].replace(COMIC_PREFIX, ''))
}

export const getPreviousComic = async (
  comic: number,
): Promise<number | null> => {
  const list = await getAllScrapedComics()

  const idxOfComic = list.findIndex(
    (key) => key.replace(COMIC_PREFIX, '') === comic.toString(),
  )

  if (idxOfComic === -1) {
    return null
  }

  if (list.length === 1) {
    return comic
  }

  if (idxOfComic === 0) {
    return parseInt(list[list.length - 1].replace(COMIC_PREFIX, ''))
  }

  return parseInt(list[idxOfComic - 1].replace(COMIC_PREFIX, ''))
}

export const getRandomScrapedComic = async (): Promise<number | null> => {
  const comics = await getUnsortedListOfScrapedComics()

  if (comics.length === 0) {
    return null
  }

  const random = comics[Math.floor(Math.random() * comics.length)]
  return parseInt(random.replace(COMIC_PREFIX, ''))
}
