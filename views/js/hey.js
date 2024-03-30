const maxWaitTime = 20
const minWaitTime = 10

let attentionVideoIds = [
    'Cv19w_2-rMc',
    '03kH9VdIKw0',
    'T3qbhmbRavc',
    '5k4Wet93W5Y',
    'A7iRRtZWgQ0',
    '1hys9CVV2Gc',
    'DRpR1j9JuX4',
    'unyEMrXxUbE',
    '3mwYNgQvxxI',
    'bKlZbjzqIcM',
    'l0h54CwVRsc',
    '5lFK6Aw-wy0',
    '-n4wZoGS09A',
    'c4FLM9f3h_0',
    '6O1bSNc3zik',
    '5lFK6Aw-wy0',
    'qrQJAA1bsfQ',
    'as_31DiJ0o',
    '-dvZnZofv4o',
    'NJag3VOo4es'
]

function generateBannerInnerHTML(videoid) {
    return `<iframe width="464" height="825" src="https://www.youtube.com/embed/${videoid}?autoplay=1&mute=1&loop=1&controls=0" frameborder="0" allow="accelerometer; loop; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
}

function putVideoToBanner(id, i) {
    let banner = document.querySelector('.attention-banner#banner' + i)
    banner.innerHTML = generateBannerInnerHTML(id)
}

function cycle(i) {
    let id = utils.randomChoice(attentionVideoIds)
    putVideoToBanner(id, i)
    let waitSeconds = utils.getRandomInt(minWaitTime, maxWaitTime)

    setTimeout(() => {
        cycle(i)
    }, waitSeconds * 1000)

}

cycle(1)
cycle(2)
