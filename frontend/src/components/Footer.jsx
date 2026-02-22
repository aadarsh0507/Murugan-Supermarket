const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border py-4 sm:py-6">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center text-xs sm:text-sm text-muted-foreground">
          © {currentYear} Murugan Mart. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
