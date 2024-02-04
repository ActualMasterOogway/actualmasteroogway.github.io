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
        toastr.info('Copied discord user to clipboard!');
        navigator.clipboard.writeText("realmasteroogway");
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

    typewriter.typeString('You can call me oogway, this website is my personal project site, feel free to take a look around!')
        .pauseFor(5500)
        .start();


});