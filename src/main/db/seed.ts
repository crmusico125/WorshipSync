import { db } from './index'
import { songs, sections, serviceDates, themes } from './schema'
import { eq } from 'drizzle-orm'

export function seedIfEmpty(): void {
  // Only seed if songs table is empty
  const existing = db.select().from(songs).limit(1).all()
  if (existing.length > 0) return

  console.log('[db] seeding initial data...')

  // ── Default theme ────────────────────────────────────────────────────────────
  const defaultThemeSettings = JSON.stringify({
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 48,
    fontWeight: '600',
    textColor: '#ffffff',
    textAlign: 'center',
    textPosition: 'middle',
    overlayOpacity: 45,
    textShadowOpacity: 40,
    maxLinesPerSlide: 2
  })

  db.insert(themes).values([
    {
      name: 'Default dark',
      type: 'global',
      isDefault: true,
      settings: defaultThemeSettings
    },
    {
      name: 'Christmas',
      type: 'seasonal',
      isDefault: false,
      seasonStart: '12-01',
      seasonEnd: '01-06',
      settings: JSON.stringify({
        fontFamily: 'Montserrat, sans-serif',
        fontSize: 48,
        fontWeight: '600',
        textColor: '#ffd700',
        textAlign: 'center',
        textPosition: 'middle',
        overlayOpacity: 55,
        textShadowOpacity: 50,
        maxLinesPerSlide: 2
      })
    },
    {
      name: 'Easter',
      type: 'seasonal',
      isDefault: false,
      seasonStart: '03-24',
      seasonEnd: '04-07',
      settings: defaultThemeSettings
    }
  ]).run()

  // ── Seed songs ────────────────────────────────────────────────────────────────
  const songData = [
    {
      title: 'Goodness of God',
      artist: 'Bethel Music',
      key: 'E',
      tempo: 'medium' as const,
      tags: JSON.stringify(['worship', 'praise']),
      sections: [
        { type: 'verse' as const,   label: 'Verse 1', lyrics: "I love You Lord\nOh Your mercy never fails me\nAll my days, I've been held in Your hands\nFrom the moment that I wake up\nUntil I lay my head\nI will sing of the goodness of God" },
        { type: 'chorus' as const,  label: 'Chorus',  lyrics: "All my life You have been faithful\nAll my life You have been so, so good\nWith every breath that I am able\nI will sing of the goodness of God" },
        { type: 'verse' as const,   label: 'Verse 2', lyrics: "I love Your voice\nYou have led me through the fire\nIn darkest night You are close like no other\nI've known You as a father\nI've known You as a friend\nI have lived in the goodness of God" },
        { type: 'bridge' as const,  label: 'Bridge',  lyrics: "Your goodness is running after\nIt's running after me\nYour goodness is running after\nIt's running after me\nWith my life laid down\nI'm surrendered now\nI give You everything\nYour goodness is running after\nIt's running after me" },
        { type: 'outro' as const,   label: 'Outro',   lyrics: "All my life You have been faithful\nAll my life You have been so, so good" }
      ]
    },
    {
      title: 'Way Maker',
      artist: 'Sinach',
      key: 'G',
      tempo: 'medium' as const,
      tags: JSON.stringify(['worship']),
      sections: [
        { type: 'verse' as const,   label: 'Verse 1', lyrics: "You are here, moving in our midst\nI worship You, I worship You\nYou are here, working in this place\nI worship You, I worship You" },
        { type: 'chorus' as const,  label: 'Chorus',  lyrics: "Way maker, miracle worker, promise keeper\nLight in the darkness\nMy God, that is who You are\nWay maker, miracle worker, promise keeper\nLight in the darkness\nMy God, that is who You are" },
        { type: 'verse' as const,   label: 'Verse 2', lyrics: "You are here, touching every heart\nI worship You, I worship You\nYou are here, healing every heart\nI worship You, I worship You" },
        { type: 'bridge' as const,  label: 'Bridge',  lyrics: "Even when I don't see it, You're working\nEven when I don't feel it, You're working\nYou never stop, You never stop working\nYou never stop, You never stop working" },
        { type: 'tag' as const,     label: 'Tag',     lyrics: "That is who You are\nThat is who You are\nThat is who You are\nThat is who You are" }
      ]
    },
    {
      title: 'What a Beautiful Name',
      artist: 'Hillsong Worship',
      key: 'D',
      tempo: 'medium' as const,
      ccliNumber: '7068424',
      tags: JSON.stringify(['worship', 'praise']),
      sections: [
        { type: 'verse' as const,      label: 'Verse 1',    lyrics: "You were the Word at the beginning\nOne with God the Lord Most High\nYour hidden glory in creation\nNow revealed in You our Christ" },
        { type: 'pre-chorus' as const, label: 'Pre-Chorus', lyrics: "What a beautiful Name it is\nWhat a beautiful Name it is\nThe Name of Jesus Christ my King" },
        { type: 'chorus' as const,     label: 'Chorus',     lyrics: "What a beautiful Name it is\nNothing compares to this\nWhat a beautiful Name it is\nThe Name of Jesus" },
        { type: 'verse' as const,      label: 'Verse 2',    lyrics: "You didn't want heaven without us\nSo Jesus, You brought heaven down\nMy sin was great, Your love was greater\nWhat could separate us now" },
        { type: 'bridge' as const,     label: 'Bridge',     lyrics: "Death could not hold You\nThe veil tore before You\nYou silenced the boast of sin and grave\nThe heavens are roaring\nThe praise of Your glory\nFor You are raised to life again" }
      ]
    },
    {
      title: 'Graves Into Gardens',
      artist: 'Elevation Worship',
      key: 'B',
      tempo: 'medium' as const,
      tags: JSON.stringify(['worship', 'praise']),
      sections: [
        { type: 'verse' as const,  label: 'Verse 1', lyrics: "I searched the world but it couldn't fill me\nMan's empty praise and treasures that fade\nAre never enough\nThen You came along and put me back together\nAnd every desire is now satisfied here in Your love" },
        { type: 'chorus' as const, label: 'Chorus',  lyrics: "Oh, there's nothing better than You\nThere's nothing better than You\nLord, there's nothing\nNothing is better than You" },
        { type: 'verse' as const,  label: 'Verse 2', lyrics: "I'm not afraid to show You my weakness\nMy failures and flaws\nLord, You've seen them all\nAnd You still call me friend\n'Cause the God of the mountain\nIs the God of the valley\nAnd there's not a place\nYour mercy and grace won't find me again" },
        { type: 'bridge' as const, label: 'Bridge',  lyrics: "You turn mourning to dancing\nYou give beauty for ashes\nYou turn shame into glory\nYou're the only one who can\nYou turn graves into gardens\nYou turn bones into armies\nYou turn seas into highways\nYou're the only one who can" }
      ]
    },
    {
      title: 'Amazing Grace',
      artist: 'Traditional',
      key: 'G',
      tempo: 'slow' as const,
      tags: JSON.stringify(['hymn', 'traditional']),
      sections: [
        { type: 'verse' as const, label: 'Verse 1', lyrics: "Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see" },
        { type: 'verse' as const, label: 'Verse 2', lyrics: "Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed" },
        { type: 'verse' as const, label: 'Verse 3', lyrics: "Through many dangers toils and snares\nI have already come\nTwas grace that brought me safe thus far\nAnd grace will lead me home" },
        { type: 'chorus' as const, label: 'Chorus', lyrics: "My chains are gone, I've been set free\nMy God, my Savior has ransomed me\nAnd like a flood His mercy reigns\nUnending love, amazing grace" }
      ]
    },
    {
      title: 'Holy Forever',
      artist: 'Bethel Music',
      key: 'A',
      tempo: 'medium' as const,
      tags: JSON.stringify(['worship', 'praise']),
      sections: [
        { type: 'verse' as const,  label: 'Verse 1', lyrics: "A thousand generations falling down in worship\nTo sing the song of ages to the Lamb\nAnd all who've gone before us and all who will believe\nWill sing the song of ages to the Lamb" },
        { type: 'chorus' as const, label: 'Chorus',  lyrics: "Holy, holy, holy is the Lord God Almighty\nWho was and is and is to come\nWith all creation I sing praise to the King of kings\nYou are my everything and I will adore You" },
        { type: 'bridge' as const, label: 'Bridge',  lyrics: "Hear Your people sing holy\nHear Your angels sing holy\nAll creation sings holy, holy\nHear the nations sing holy\nHear the children sing holy\nAll creation sings holy, holy" }
      ]
    }
  ]

  for (const song of songData) {
    const { sections: sectionData, ...songFields } = song

    const [inserted] = db.insert(songs).values(songFields).returning({ id: songs.id }).all()

    const sectionRows = sectionData.map((s, i) => ({
      songId: inserted.id,
      type: s.type,
      label: s.label,
      lyrics: s.lyrics,
      orderIndex: i
    }))

    db.insert(sections).values(sectionRows).run()
  }

  // ── Seed upcoming service dates ───────────────────────────────────────────────
  const today = new Date()
  const upcomingSundays = getNextSundays(today, 4)

  db.insert(serviceDates).values(
    upcomingSundays.map((date, i) => ({
      date,
      label: i === 0 ? 'Regular Sunday' : 'Regular Sunday',
      status: 'empty' as const
    }))
  ).run()

  console.log('[db] seed complete — 6 songs, 4 upcoming Sundays')
}

function getNextSundays(from: Date, count: number): string[] {
  const sundays: string[] = []
  const d = new Date(from)

  // Find next Sunday
  const daysUntilSunday = (7 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + daysUntilSunday)

  for (let i = 0; i < count; i++) {
    sundays.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 7)
  }

  return sundays
}