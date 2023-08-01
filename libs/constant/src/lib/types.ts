export type EditCategoryData = {
  id: number;
  name: string;
  description: string;
};

export type EditCategoryModalProps = {
  editCategoryData: EditCategoryData;
  setEditCategoryData: React.Dispatch<React.SetStateAction<EditCategoryData>>;
  editModalOpen: boolean;
  handleEdiCategorysubmit: () => void;
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

// Interface for the add category data start-----
export type CategoryData = {
  id?: number;
  name: string;
  description: string;
};

// Props interface for the add category modal start here--
export type AddCategoryModalProps = {
  addCategoryOpen: boolean;
  setAddCategoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addCategoryTextFieldData: CategoryData;
  setAddCategoryTextFieldData: React.Dispatch<
    React.SetStateAction<CategoryData>
  >;
  handleCategorySubmit: () => void;
};

//category table props interfaces-------
export type CategoriesTableProps = {
  categoryData?: CategoryDataArrayType | null;
  fetchCategoryData: () => void;
};

//category data types------------
export type CategoryDataType = {
  id: number;
  name: string;
  description: string;
  updated: string;
  created: string;
}

export type CategoryDataArrayType = CategoryDataType[]
