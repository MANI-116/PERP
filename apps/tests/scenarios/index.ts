const scenario = process.argv[2];

switch (scenario) {
    case "1":
        await import("./scenario-01-limit-accepted");
        break;

    case "2":
        await import("./scenario-02-insufficient-margin");
        break;

    case "3":
        await import("./scenario-03-full-fill");
        break;

    case "4":
        await import("./scenario-04-partial-fill");
        break;

    case "5":
        await import("./scenario-05-fifo-full-fill");
        break;

    case "6":
        await import("./scenario-06-fifo-partial-fill");
        break;

    case "7":
        await import("./scenario-07-multi-level-fill");
        break;

    case "8":
        await import("./scenario-08-no-crossing");
        break;

    case "9":
        await import("./scenario-09-position-increase");
        break;

    case "10":
        await import("./scenario-10-position-reduce");
        break;

    case "11":
        await import("./scenario-11-position-flip");
        break;

    case "12":
        await import("./scenario-12-market-empty-book");
        break;

    case "13":
        await import("./scenario-13-market-single-fill");
        break;

    case "14":
        await import("./scenario-14-market-multi-level-sweep");
        break;

    default:
        console.log(`
Available Scenarios

1  - limit accepted
2  - insufficient margin
3  - full fill
4  - partial fill
5  - fifo full fill
6  - fifo partial fill
7  - multi-level fill
8  - no crossing
9  - position increase
10 - position reduce
11 - position flip
12 - market empty book
13 - market single fill
14 - market multi-level sweep
        `);
}











