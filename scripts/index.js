function navigateToNewTab(url) {
    window.open(url, '_blank');
}

document.addEventListener('DOMContentLoaded', function() {
    toastr.options.escapeHtml = true;
    toastr.options.closeButton = true;

    const discord_social = document.querySelector("#discord_social");
    const github_social = document.querySelector("#github_social");
    
    const description = document.querySelector("#description");

    discord_social.addEventListener("click", function() {
        /* 
        toastr.info('Copied discord user to clipboard!');
        navigator.clipboard.writeText("realmasteroogway");
        */
        navigateToNewTab("https://discord.com/users/830031741225009203")
    });

    github_social.addEventListener("click", function() {
        navigateToNewTab("https://github.com/ActualMasterOogway");
    });


    VANTA.NET({
        el: "#background_points",
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x52de40,
        backgroundColor: 0x191e20,
        points: 20.00,
        maxDistance: 15.00,
        spacing: 14.00
    });

    typewriter = new Typewriter(description, {
        loop: false
    });
    let translation = 'But you can call me Oogway, this website is my personal project site, feel free to take a look around!'
    if (this.location.href.includes("actualmasteroogway.github.io/de")) {
        translation = 'Du kannst mich aber Oogway nennen. Diese Website ist für meine persönliche Projekte, aber das sollte dich nicht aufhalten dich umzuschauen!'
    }
    typewriter.typeString(translation)
        .pauseFor(6750) 
        .start();


});